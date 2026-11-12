// clearspec hosted web app: GitHub sign-in, the React UI (static assets), the API, and WebSocket relays.
// Runs execute on the user's computer (`clearspec connect`, their own agent logins). The computer talks to the
// run's Durable Object over an outbound WebSocket; browsers talk to the same Durable Object.
import type { Env, User } from "./env"
import { callback, currentUser, login, logout, signSession } from "./auth"
import { AGENTS, CLAUDE_MODELS } from "./catalog"
import type { RunSummary } from "./run"
import { err, json, randomId, randomToken, readJson } from "./util"

export { Run } from "./run"
export { UserHub, Pairing } from "./user-hub"

const hub = (env: Env, uid: string) => env.USER_HUB.get(env.USER_HUB.idFromName(uid)) as any
const run = (env: Env, id: string) => env.RUN.get(env.RUN.idFromName(id)) as any
const pairing = (env: Env) => env.PAIRING.get(env.PAIRING.idFromName("global")) as any
const validRunId = (id: string) => /^[a-f0-9]{8,24}$/.test(id)

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)
    const p = url.pathname
    try {
      // ---------- sign-in ----------
      if (p === "/auth/login") return login(req, env)
      if (p === "/auth/callback") return callback(req, env)
      if (p === "/auth/logout") return logout()
      // Local testing without a GitHub OAuth app: only with DEV_LOGIN=1 in .dev.vars AND a localhost host.
      if (p === "/auth/dev-login" && env.DEV_LOGIN === "1" && ["localhost", "127.0.0.1"].includes(url.hostname)) {
        const sid = await signSession(env, { uid: "1", login: "dev", name: "Local dev", avatar: "data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22/%3E" })
        return new Response(null, { status: 302, headers: { location: "/", "set-cookie": `sid=${encodeURIComponent(sid)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400` } })
      }

      // ---------- runner and connector endpoints (token auth, no cookie) ----------
      if (p === "/api/connector/claim" && req.method === "POST") {
        const b = await readJson<{ code?: string; name?: string; platform?: string; version?: string }>(req)
        const who = await pairing(env).claim(String(b.code ?? "").toUpperCase())
        if (!who) return err("That pairing code is wrong or expired. Make a new one in the web app.", 400)
        const { token } = await hub(env, who.uid).addConnector(who.uid, b)
        return json({ token, login: who.login })
      }
      if (p === "/ws/connector") {
        const uid = (url.searchParams.get("token") ?? "").split(".")[0]
        if (!/^\d+$/.test(uid)) return new Response("forbidden", { status: 403 })
        const inner = new URL(req.url)
        inner.pathname = "/connector"
        return hub(env, uid).fetch(new Request(inner, req))
      }
      let m = /^\/ws\/runner\/([a-f0-9]+)$/.exec(p)
      if (m && validRunId(m[1])) {
        const inner = new URL(req.url)
        inner.pathname = "/runner"
        return run(env, m[1]).fetch(new Request(inner, req))
      }
      m = /^\/api\/runner\/([a-f0-9]+)\/body$/.exec(p)
      if (m && validRunId(m[1])) {
        const body = await run(env, m[1]).body(url.searchParams.get("token") ?? "")
        return body ? json(body) : err("forbidden", 403)
      }

      // ---------- everything below needs a signed-in user ----------
      const needsUser = p.startsWith("/api/") || p === "/ws" || p.startsWith("/files/")
      if (!needsUser) return env.ASSETS.fetch(req)
      const user = await currentUser(req, env)
      if (!user) return err("unauthorized", 401)
      return await authed(req, env, user, url)
    } catch (e: any) {
      return err(e?.message ?? "Server error", 500)
    }
  },
} satisfies ExportedHandler<Env>

async function authed(req: Request, env: Env, user: User, url: URL): Promise<Response> {
  const p = url.pathname
  const h = hub(env, user.uid)

  if (p === "/api/me") return json(user)
  if (p === "/api/config") {
    return json({
      hosted: true,
      server: url.origin,
      skillDir: "",
      defaultProject: "",
      agents: AGENTS,
      claudeModels: CLAUDE_MODELS,
    })
  }

  // ---------- computers (connectors) ----------
  if (p === "/api/connectors" && req.method === "GET") return json(await h.listConnectors())
  if (p === "/api/connectors/pair" && req.method === "POST") {
    const { code, expires } = await pairing(env).create(user.uid, user.login)
    return json({ code, expires, command: `npx -y clearspec@0.1 connect ${code} --server ${url.origin}` })
  }
  let m = /^\/api\/connectors\/([a-f0-9]+)\/(remove|config|pick-folder)$/.exec(p)
  if (m && req.method === "POST") {
    const [, id, action] = m
    if (action === "remove") { await h.removeConnector(id); return json({ ok: true }) }
    try {
      const body = await readJson(req)
      return json(await h.rpc(id, action, body, action === "pick-folder" ? 180_000 : 30_000))
    } catch (e: any) { return err(e.message, 409) }
  }

  // ---------- models, account and usage for the draft screen ----------
  if (p === "/api/agent-info" && req.method === "POST") {
    const b = await readJson<any>(req)
    try {
      return json(await h.rpc(b.connectorId, "agent-info", { ...b, connectorId: undefined }, 160_000))
    } catch (e: any) {
      return json({ models: [], limits: [], error: e.message })
    }
  }

  // ---------- runs ----------
  if (p === "/api/sessions" && req.method === "GET") {
    const runs: RunSummary[] = await h.listRuns()
    // Refresh state from each run (cheap; the list is short).
    const fresh = await Promise.all(runs.map(async (r) => ({ ...r, ...((await run(env, r.id).summary()) ?? {}) })))
    return json(fresh)
  }
  if (p === "/api/sessions" && req.method === "POST") return createRun(req, env, user)

  m = /^\/api\/sessions\/([a-f0-9]+)\/(stop|message|answer|model)$/.exec(p)
  if (m && req.method === "POST") {
    const r = await run(env, m[1]).command(user.uid, m[2], await readJson(req))
    return r.ok ? json({ ok: true }) : err(r.error ?? "failed", r.error === "not found" ? 404 : 409)
  }

  if (p === "/ws") {
    const id = url.searchParams.get("session") ?? ""
    if (!validRunId(id)) return err("not found", 404)
    const inner = new URL(req.url)
    inner.pathname = "/browser"
    inner.search = `?uid=${encodeURIComponent(user.uid)}`
    return run(env, id).fetch(new Request(inner, req))
  }

  m = /^\/files\/([a-f0-9]+)\/(.+)$/.exec(p)
  if (m && validRunId(m[1])) {
    const f = await run(env, m[1]).file(user.uid, decodeURIComponent(m[2]))
    if (!f) return new Response("not found", { status: 404 })
    return new Response(f.data, {
      headers: {
        "content-type": f.type,
        "cache-control": "no-store",
        // Mockups are agent-written HTML: keep them off the network and away from the app's cookies and API.
        "content-security-policy": "default-src 'self' 'unsafe-inline' data: blob:; connect-src 'none'; frame-ancestors 'self'",
      },
    })
  }

  return err("not found", 404)
}

async function createRun(req: Request, env: Env, user: User) {
  const b = await readJson<any>(req)
  const idea = String(b.idea ?? "").trim()
  if (!idea) return err("Describe the idea first.")
  const agentId = String(b.agentId ?? "")
  const agent = AGENTS.find((a) => a.id === agentId)
  if (!agent) return err("Choose an agent.")

  const h = hub(env, user.uid)
  const comp = (await h.listConnectors()).find((c: any) => c.id === b.connectorId)
  if (!comp) return err("Choose one of your computers.")
  if (!comp.online) return err(`${comp.name} is offline. Run \`clearspec connect\` on it.`, 409)

  const id = randomId(6)
  const token = randomToken(24)
  // What the runner needs to start the local engine.
  const body = {
    agentId, customCommand: b.customCommand, projectDir: String(b.projectDir ?? ""),
    idea, model: String(b.model ?? ""), effort: String(b.effort ?? ""), budgetUsd: Number(b.budgetUsd) || undefined,
  }
  const summary: RunSummary = {
    id, agent: agentId, agentName: agent.name, projectDir: body.projectDir, idea, model: body.model,
    budgetUsd: Number(b.budgetUsd) || null, state: "starting", createdAt: new Date().toISOString(), where: `Your computer: ${comp.name}`,
  }
  await run(env, id).init({ owner: user.uid, token, summary, body })
  await h.addRun(summary)
  try { await h.startRun(b.connectorId, { runId: id, runToken: token, body }) }
  catch (e: any) { return err(e.message, 409) }
  return json(summary)
}
