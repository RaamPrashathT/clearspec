// One per GitHub user: their paired computers (live connector WebSockets), requests to those computers,
// and their list of runs.
import { DurableObject } from "cloudflare:workers"
import type { Env } from "./env"
import type { RunSummary } from "./run"
import { randomId, randomToken, safeEqual, sha256 } from "./util"

export type Connector = {
  id: string
  name: string
  platform: string
  version: string
  cwd: string
  online: boolean
  lastSeen: number
  createdAt: number
}

type Pending = { resolve: (v: any) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }

export class UserHub extends DurableObject<Env> {
  sql: SqlStorage
  pending = new Map<string, Pending>()

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    this.sql = ctx.storage.sql
    this.sql.exec(`CREATE TABLE IF NOT EXISTS connectors (id TEXT PRIMARY KEY, name TEXT, platform TEXT, version TEXT, cwd TEXT, secret_hash TEXT, created REAL, last_seen REAL)`)
    this.sql.exec(`CREATE TABLE IF NOT EXISTS runs (id TEXT PRIMARY KEY, created REAL, json TEXT)`)
  }

  // ---------- computers ----------

  async addConnector(uid: string, info: { name?: string; platform?: string; version?: string }) {
    const id = randomId(5)
    const secret = randomToken(24)
    this.sql.exec(
      `INSERT INTO connectors (id, name, platform, version, cwd, secret_hash, created, last_seen) VALUES (?, ?, ?, ?, '', ?, ?, ?)`,
      id, String(info.name ?? "Computer").slice(0, 80), String(info.platform ?? ""), String(info.version ?? ""), await sha256(secret), Date.now(), Date.now(),
    )
    return { id, token: `${uid}.${id}.${secret}` }
  }

  listConnectors(): Connector[] {
    return this.sql.exec(`SELECT * FROM connectors ORDER BY created`).toArray().map((r) => ({
      id: r.id as string, name: r.name as string, platform: r.platform as string, version: r.version as string, cwd: r.cwd as string,
      online: this.ctx.getWebSockets(r.id as string).length > 0, lastSeen: r.last_seen as number, createdAt: r.created as number,
    }))
  }

  removeConnector(id: string) {
    for (const ws of this.ctx.getWebSockets(id)) {
      try { ws.send(JSON.stringify({ t: "revoked" })); ws.close(4401, "revoked") } catch { /* gone */ }
    }
    this.sql.exec(`DELETE FROM connectors WHERE id = ?`, id)
  }

  private socket(id: string) {
    const ws = this.ctx.getWebSockets(id)[0]
    if (!ws) throw new Error("That computer is offline. Run `clearspec connect` on it.")
    return ws
  }

  startRun(connectorId: string, msg: { runId: string; runToken: string; body: unknown }) {
    this.socket(connectorId).send(JSON.stringify({ t: "start", ...msg }))
  }

  /** Ask a computer something (its agents, models, a folder dialog) and wait for the answer. */
  rpc(connectorId: string, method: string, body: unknown, timeoutMs = 60_000): Promise<unknown> {
    const ws = this.socket(connectorId)
    const id = randomId(6)
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error("The computer didn't answer in time.")) }, timeoutMs)
      this.pending.set(id, { resolve, reject, timer })
      ws.send(JSON.stringify({ t: "rpc", id, method, body }))
    })
  }

  // ---------- runs ----------

  addRun(summary: RunSummary) {
    this.sql.exec(`INSERT INTO runs (id, created, json) VALUES (?, ?, ?)`, summary.id, Date.now(), JSON.stringify(summary))
  }

  listRuns(limit = 30): RunSummary[] {
    return this.sql.exec(`SELECT json FROM runs ORDER BY created DESC LIMIT ?`, limit).toArray().map((r) => JSON.parse(r.json as string))
  }

  // ---------- connector WebSocket ----------

  async fetch(req: Request) {
    const url = new URL(req.url)
    if (url.pathname !== "/connector" || req.headers.get("upgrade") !== "websocket") return new Response("not found", { status: 404 })
    const [, id, secret] = (url.searchParams.get("token") ?? "").split(".")
    const row = id ? this.sql.exec(`SELECT secret_hash FROM connectors WHERE id = ?`, id).toArray()[0] : undefined
    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)
    if (!row || !secret || !safeEqual(await sha256(secret), row.secret_hash as string)) {
      server.accept()
      server.close(4401, "unknown computer")
      return new Response(null, { status: 101, webSocket: client })
    }
    for (const old of this.ctx.getWebSockets(id)) old.close(4000, "replaced")
    this.ctx.acceptWebSocket(server, [id])
    this.sql.exec(`UPDATE connectors SET last_seen = ? WHERE id = ?`, Date.now(), id)
    return new Response(null, { status: 101, webSocket: client })
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    const id = this.ctx.getTags(ws)[0]
    const m = JSON.parse(typeof raw === "string" ? raw : new TextDecoder().decode(raw))
    if (m.t === "hello") {
      this.sql.exec(`UPDATE connectors SET name = ?, platform = ?, version = ?, cwd = ?, last_seen = ? WHERE id = ?`,
        String(m.name ?? "").slice(0, 80), String(m.platform ?? ""), String(m.version ?? ""), String(m.cwd ?? ""), Date.now(), id)
    } else if (m.t === "rpc-result") {
      const p = this.pending.get(m.id)
      if (!p) return
      this.pending.delete(m.id)
      clearTimeout(p.timer)
      if (m.ok) p.resolve(m.data); else p.reject(new Error(m.error ?? "failed"))
    } else if (m.t === "ping") {
      this.sql.exec(`UPDATE connectors SET last_seen = ? WHERE id = ?`, Date.now(), id)
    }
  }

  async webSocketClose(ws: WebSocket) {
    const id = this.ctx.getTags(ws)[0]
    this.sql.exec(`UPDATE connectors SET last_seen = ? WHERE id = ?`, Date.now(), id)
  }
}

/** Singleton: short pairing codes → the user who asked for them. */
export class Pairing extends DurableObject<Env> {
  sql: SqlStorage
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    this.sql = ctx.storage.sql
    this.sql.exec(`CREATE TABLE IF NOT EXISTS codes (code TEXT PRIMARY KEY, uid TEXT, login TEXT, expires REAL)`)
  }

  create(uid: string, login: string) {
    this.sql.exec(`DELETE FROM codes WHERE expires < ? OR uid = ?`, Date.now(), uid)
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // no 0/O/1/I
    const pick = () => [...crypto.getRandomValues(new Uint8Array(4))].map((b) => alphabet[b % alphabet.length]).join("")
    const code = `${pick()}-${pick()}`
    const expires = Date.now() + 15 * 60_000
    this.sql.exec(`INSERT INTO codes (code, uid, login, expires) VALUES (?, ?, ?, ?)`, code, uid, login, expires)
    return { code, expires }
  }

  claim(code: string): { uid: string; login: string } | null {
    const row = this.sql.exec(`SELECT uid, login, expires FROM codes WHERE code = ?`, code).toArray()[0]
    this.sql.exec(`DELETE FROM codes WHERE code = ?`, code)
    if (!row || (row.expires as number) < Date.now()) return null
    return { uid: row.uid as string, login: row.login as string }
  }
}
