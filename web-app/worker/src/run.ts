// One clearspec run. Holds the event log (replayed to browsers on connect), the spec and mockup files the runner
// uploads, and relays between browsers and the runner (the user's computer, or a cloud sandbox).
import { DurableObject } from "cloudflare:workers"
import type { Env } from "./env"
import { safeEqual } from "./util"

export type RunSummary = {
  id: string
  agent: string
  agentName: string
  projectDir: string
  idea: string
  model: string
  budgetUsd: number | null
  state: string
  createdAt: string
  where: string // "Your computer: <name>"
}

const MIME: Record<string, string> = {
  html: "text/html; charset=utf-8", css: "text/css; charset=utf-8", js: "text/javascript; charset=utf-8",
  json: "application/json", md: "text/markdown; charset=utf-8", yaml: "text/yaml; charset=utf-8", yml: "text/yaml; charset=utf-8",
  svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", txt: "text/plain; charset=utf-8",
}

export class Run extends DurableObject<Env> {
  sql: SqlStorage

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    this.sql = ctx.storage.sql
    this.sql.exec(`CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT)`)
    this.sql.exec(`CREATE TABLE IF NOT EXISTS events (i INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT, eid TEXT, json TEXT)`)
    this.sql.exec(`CREATE TABLE IF NOT EXISTS files (path TEXT PRIMARY KEY, data BLOB, mtime REAL)`)
  }

  private get(k: string): any {
    const row = this.sql.exec(`SELECT v FROM meta WHERE k = ?`, k).toArray()[0]
    return row ? JSON.parse(row.v as string) : undefined
  }
  private set(k: string, v: unknown) {
    this.sql.exec(`INSERT INTO meta (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v`, k, JSON.stringify(v))
  }

  async init(args: { owner: string; token: string; summary: RunSummary; body: Record<string, unknown> }) {
    this.set("owner", args.owner)
    this.set("token", args.token)
    this.set("summary", args.summary)
    this.set("body", args.body)
    this.set("received", 0)
  }

  summary(): RunSummary | undefined {
    return this.get("summary")
  }

  owns(uid: string) {
    return this.get("owner") === uid
  }

  /** The run's settings, for the runner. */
  body(token: string) {
    const t = this.get("token")
    return t && safeEqual(token, t) ? this.get("body") : null
  }

  /** answer / message / stop / model from the browser, forwarded to the runner. */
  command(uid: string, cmd: string, body: unknown): { ok: boolean; error?: string } {
    if (!this.owns(uid)) return { ok: false, error: "not found" }
    const runner = this.ctx.getWebSockets("runner")[0]
    if (!runner) {
      if (cmd === "stop") { this.markEnded("stopped", "Stopped"); return { ok: true } }
      return { ok: false, error: "The runner isn't connected right now. If this run uses your computer, check that `clearspec connect` is still running." }
    }
    runner.send(JSON.stringify({ t: "cmd", cmd, body }))
    return { ok: true }
  }

  file(uid: string, path: string): { data: ArrayBuffer; type: string } | null {
    if (!this.owns(uid)) return null
    const row = this.sql.exec(`SELECT data FROM files WHERE path = ?`, path).toArray()[0]
    if (!row) return null
    const ext = path.split(".").pop()?.toLowerCase() ?? ""
    return { data: row.data as ArrayBuffer, type: MIME[ext] ?? "application/octet-stream" }
  }

  private events(): unknown[] {
    return this.sql.exec(`SELECT json FROM events ORDER BY i`).toArray().map((r) => JSON.parse(r.json as string))
  }

  /** Store an event, merging streamed text/thought deltas into one row, like the local server does. */
  private store(e: any) {
    const merged = ({ "text-delta": "text", "thought-delta": "thought" } as Record<string, string>)[e.type]
    if (merged) {
      const last = this.sql.exec(`SELECT i, json FROM events ORDER BY i DESC LIMIT 1`).toArray()[0]
      if (last) {
        const prev = JSON.parse(last.json as string)
        if (prev.type === merged && prev.id === e.id) {
          prev.text += e.text
          this.sql.exec(`UPDATE events SET json = ? WHERE i = ?`, JSON.stringify(prev), last.i)
          return
        }
      }
      this.sql.exec(`INSERT INTO events (type, eid, json) VALUES (?, ?, ?)`, merged, e.id ?? null, JSON.stringify({ ...e, type: merged, role: "agent" }))
      return
    }
    this.sql.exec(`INSERT INTO events (type, eid, json) VALUES (?, ?, ?)`, e.type, e.id ?? null, JSON.stringify(e))
  }

  private broadcast(e: unknown) {
    const msg = JSON.stringify(e)
    for (const ws of this.ctx.getWebSockets("browser")) {
      try { ws.send(msg) } catch { /* closed */ }
    }
  }

  private emit(e: any) {
    const ev = { seq: 1_000_000 + Date.now() % 1_000_000, at: Date.now(), ...e }
    this.store(ev)
    this.broadcast(ev)
  }

  private markEnded(state: string, detail: string) {
    const s = this.summary()
    if (s && !["done", "stopped", "error"].includes(s.state)) {
      this.set("summary", { ...s, state })
      this.emit({ type: "status", state, detail })
    }
  }

  async fetch(req: Request) {
    const url = new URL(req.url)
    if (req.headers.get("upgrade") !== "websocket") return new Response("expected websocket", { status: 426 })
    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)

    if (url.pathname === "/browser") {
      if (!this.owns(url.searchParams.get("uid") ?? "")) return new Response("not found", { status: 404 })
      this.ctx.acceptWebSocket(server, ["browser"])
      server.send(JSON.stringify({ type: "hello", session: this.summary(), events: this.events() }))
      return new Response(null, { status: 101, webSocket: client })
    }

    if (url.pathname === "/runner") {
      const t = this.get("token")
      if (!t || !safeEqual(url.searchParams.get("token") ?? "", t)) return new Response("forbidden", { status: 403 })
      for (const old of this.ctx.getWebSockets("runner")) old.close(4000, "replaced")
      this.ctx.acceptWebSocket(server, ["runner"])
      // Tell the runner how many messages we already have, so it resends only what we missed.
      server.send(JSON.stringify({ t: "resume", received: this.get("received") ?? 0 }))
      return new Response(null, { status: 101, webSocket: client })
    }
    return new Response("not found", { status: 404 })
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    if (!this.ctx.getTags(ws).includes("runner")) return // browsers only listen; commands come over HTTP
    const m = JSON.parse(typeof raw === "string" ? raw : new TextDecoder().decode(raw))
    this.set("received", (this.get("received") ?? 0) + 1)

    if (m.t === "started") {
      const s = this.summary()
      if (s) this.set("summary", { ...s, agentName: m.session.agentName ?? s.agentName, model: m.session.model ?? s.model, projectDir: m.session.projectDir ?? s.projectDir, state: m.session.state ?? s.state })
    } else if (m.t === "event") {
      const e = m.e
      if (e.type === "status") {
        const s = this.summary()
        if (s) this.set("summary", { ...s, state: e.state })
      }
      if (e.type === "models") {
        const s = this.summary()
        if (s && e.current) this.set("summary", { ...s, model: e.current })
      }
      this.store(e)
      this.broadcast(e)
    } else if (m.t === "file") {
      const bin = Uint8Array.from(atob(m.data), (c) => c.charCodeAt(0))
      this.sql.exec(
        `INSERT INTO files (path, data, mtime) VALUES (?, ?, ?) ON CONFLICT(path) DO UPDATE SET data = excluded.data, mtime = excluded.mtime`,
        String(m.path), bin.buffer, Number(m.mtime) || Date.now(),
      )
    } else if (m.t === "done") {
      this.set("done", true)
    }
  }

  async webSocketClose(ws: WebSocket) {
    if (!this.ctx.getTags(ws).includes("runner")) return
    if (this.get("done") || this.ctx.getWebSockets("runner").length) return
    const s = this.summary()
    if (s && !["done", "stopped", "error"].includes(s.state)) {
      this.emit({
        type: "notice", severity: "warning", kind: "stall",
        title: "Your computer disconnected",
        description: "The run continues when `clearspec connect` reconnects. If you closed it, start it again on that computer.",
      })
    }
  }

  async webSocketError(ws: WebSocket) {
    await this.webSocketClose(ws)
  }
}
