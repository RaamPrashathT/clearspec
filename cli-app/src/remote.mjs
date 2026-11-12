// `clearspec connect`: pairs this computer with the hosted web app (web-app/), waits for runs, and runs them
// with the agent CLIs already logged in here. It starts the local engine (server.mjs) headlessly and relays
// its events to the run's Durable Object.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import WebSocket from "ws";
import { startServer, resolveSkillDir } from "./server.mjs";

const VERSION = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
const MAX_FILE = 900 * 1024; // Workers WebSocket messages are capped at 1 MiB
const wsBase = (server) => server.replace(/^http/, "ws").replace(/\/$/, "");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toLocaleTimeString(), ...a);

/** The local engine: server.mjs on a random port, reachable only with our token. */
export async function startLocalEngine({ skillDir, defaultProject }) {
  const token = randomBytes(18).toString("base64url");
  const srv = await startServer({ port: 0, skillDir, defaultProject, token });
  const base = `http://127.0.0.1:${srv.port}`;
  const headers = { "x-clearspec-token": token, "content-type": "application/json" };
  async function call(p, body) {
    const res = await fetch(base + p, body === undefined ? { headers } : { method: "POST", headers, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
    return data;
  }
  function watch(sessionId, onEvent) {
    const ws = new WebSocket(`ws://127.0.0.1:${srv.port}/ws?session=${sessionId}`, { headers: { origin: base, "x-clearspec-token": token } });
    ws.on("message", (m) => onEvent(JSON.parse(m.toString())));
    return ws;
  }
  return { call, watch, close: srv.close };
}

/** Every file of a spec folder (REQUIREMENTS.md, mockups/**), relative to clearspec/. */
function listSpecFiles(specRoot, name) {
  const out = [];
  const walk = (dir, rel, depth) => {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const d of entries) {
      if (d.name.startsWith(".") || d.name === "node_modules") continue;
      const full = path.join(dir, d.name);
      const r = `${rel}/${d.name}`;
      if (d.isDirectory() && depth < 4) walk(full, r, depth + 1);
      else if (d.isFile()) out.push({ full, rel: r });
    }
  };
  walk(path.join(specRoot, name), name, 0);
  return out;
}

/**
 * Relay one run between the local engine and the cloud.
 * Upstream protocol (JSON over WebSocket to /ws/runner/:runId?token=…):
 *   runner → cloud: {t:"started", session} {t:"event", n, e} {t:"file", path, data, mtime} {t:"done"}
 *   cloud → runner: {t:"resume", received} {t:"cmd", cmd, body}
 */
export async function bridgeRun({ engine, server, runId, runToken, body }) {
  const sent = []; // every upstream message, so a reconnect can resend what the cloud missed
  let up = null;
  let finished = false;
  let session = null;
  const fileTimes = new Map();

  const push = (msg) => {
    sent.push(msg);
    if (up?.readyState === WebSocket.OPEN) up.send(JSON.stringify(msg));
  };

  const connect = () => new Promise((resolve) => {
    const ws = new WebSocket(`${wsBase(server)}/ws/runner/${runId}?token=${encodeURIComponent(runToken)}`);
    ws.on("open", () => { up = ws; resolve(true); });
    ws.on("message", async (raw) => {
      const m = JSON.parse(raw.toString());
      if (m.t === "resume") {
        for (const msg of sent.slice(m.received ?? 0)) ws.send(JSON.stringify(msg));
      } else if (m.t === "cmd" && session) {
        try { await engine.call(`/api/sessions/${session.id}/${m.cmd}`, m.body ?? {}); }
        catch (err) { push({ t: "event", e: { type: "notice", severity: "warning", title: `Couldn't ${m.cmd}`, description: err.message } }); }
      }
    });
    ws.on("close", () => { if (up === ws) up = null; resolve(false); });
    ws.on("error", () => {});
  });

  // Keep the upstream connection alive until the run ends; reconnect with backoff.
  (async () => {
    for (let attempt = 0; !finished; attempt++) {
      await connect();
      if (finished) break;
      while (up && !finished) await sleep(1000);
      if (!finished) await sleep(Math.min(30_000, 1000 * 2 ** Math.min(attempt, 5)));
    }
  })();
  for (let i = 0; i < 50 && !up; i++) await sleep(200);

  function syncFiles(outputs) {
    if (!session) return;
    const root = path.join(session.projectDir, "clearspec");
    for (const o of outputs) {
      for (const f of listSpecFiles(root, o.name)) {
        let st; try { st = fs.statSync(f.full); } catch { continue; }
        if (fileTimes.get(f.rel) === st.mtimeMs) continue;
        fileTimes.set(f.rel, st.mtimeMs);
        if (st.size > MAX_FILE) { push({ t: "event", e: { type: "notice", severity: "warning", title: "File too large to preview", description: f.rel } }); continue; }
        push({ t: "file", path: f.rel, data: fs.readFileSync(f.full).toString("base64"), mtime: st.mtimeMs });
      }
    }
  }

  try {
    session = await engine.call("/api/sessions", body);
  } catch (err) {
    push({ t: "event", e: { type: "error", kind: /not found|installed/i.test(err.message) ? "not-installed" : "other", message: err.message } });
    push({ t: "event", e: { type: "status", state: "error", detail: err.message } });
    push({ t: "done" });
    finished = true;
    await sleep(1500);
    up?.close();
    return;
  }
  push({ t: "started", session });
  log(`Run ${runId}: ${session.agentName} in ${session.projectDir}`);

  await new Promise((resolve) => {
    const ws = engine.watch(session.id, (e) => {
      const events = e.type === "hello" ? e.events : [e];
      for (const ev of events) {
        push({ t: "event", e: ev });
        if (ev.type === "outputs") syncFiles(ev.outputs);
        if (ev.type === "status" && ["done", "stopped", "error"].includes(ev.state)) setTimeout(resolve, 500);
      }
    });
    ws.on("close", resolve);
  });
  push({ t: "done" });
  finished = true;
  log(`Run ${runId}: finished`);
  await sleep(1500);
  up?.close();
}

// ---------------------------------------------------------------------------------------------
// clearspec connect

const CONFIG = path.join(os.homedir(), ".clearspec", "connector.json");
const readConfig = () => { try { return JSON.parse(fs.readFileSync(CONFIG, "utf8")); } catch { return null; } };
function writeConfig(c) {
  fs.mkdirSync(path.dirname(CONFIG), { recursive: true });
  fs.writeFileSync(CONFIG, JSON.stringify(c, null, 2), { mode: 0o600 });
}

export async function connect({ code, server, project }) {
  let cfg = readConfig();
  if (code) {
    if (!server) throw new Error("Pass --server <url of the clearspec web app>.");
    const res = await fetch(`${server.replace(/\/$/, "")}/api/connector/claim`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: code.trim().toUpperCase(), name: os.hostname(), platform: `${process.platform}-${process.arch}`, version: VERSION }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? `Pairing failed (HTTP ${res.status})`);
    cfg = { server: server.replace(/\/$/, ""), token: data.token, login: data.login, name: os.hostname() };
    writeConfig(cfg);
    console.log(`\n  Paired with ${data.login}'s clearspec account.`);
  }
  if (!cfg?.token) throw new Error("This computer isn't paired yet. In the web app choose “Add a computer” and run the command it shows.");

  const skillDir = resolveSkillDir();
  if (!skillDir) throw new Error("clearspec skill not found next to the package.");
  const engine = await startLocalEngine({ skillDir, defaultProject: path.resolve(project ?? process.cwd()) });
  console.log(`\n  clearspec ${VERSION} connected to ${cfg.server}\n  Runs started in the web app run here, with your own agent logins.\n  Default project: ${path.resolve(project ?? process.cwd())}\n  Keep this window open. Ctrl+C to disconnect.\n`);

  for (let attempt = 0; ; attempt++) {
    const ok = await new Promise((resolve) => {
      const ws = new WebSocket(`${wsBase(cfg.server)}/ws/connector?token=${encodeURIComponent(cfg.token)}`);
      let alive = null;
      ws.on("open", () => {
        attempt = 0;
        log("Online.");
        ws.send(JSON.stringify({ t: "hello", name: cfg.name, platform: `${process.platform}-${process.arch}`, version: VERSION, cwd: path.resolve(project ?? process.cwd()) }));
        alive = setInterval(() => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify({ t: "ping" })), 25_000);
      });
      ws.on("message", async (raw) => {
        const m = JSON.parse(raw.toString());
        if (m.t === "start") {
          bridgeRun({ engine, server: cfg.server, runId: m.runId, runToken: m.runToken, body: m.body }).catch((err) => log("Run failed:", err.message));
        } else if (m.t === "rpc") {
          const routes = { config: ["/api/config"], "agent-info": ["/api/agent-info", m.body], "pick-folder": ["/api/pick-folder", m.body] };
          const [p, b] = routes[m.method] ?? [];
          try {
            if (!p) throw new Error(`Unknown request ${m.method}`);
            ws.send(JSON.stringify({ t: "rpc-result", id: m.id, ok: true, data: await engine.call(p, b) }));
          } catch (err) {
            ws.send(JSON.stringify({ t: "rpc-result", id: m.id, ok: false, error: err.message }));
          }
        } else if (m.t === "revoked") {
          log("This computer was removed from your account. Pair it again to reconnect.");
          fs.rmSync(CONFIG, { force: true });
          process.exit(1);
        }
      });
      ws.on("close", (codeNum) => { clearInterval(alive); resolve(codeNum !== 4401); });
      ws.on("error", (err) => log("Connection problem:", err.message));
    });
    if (!ok) throw new Error("The server rejected this computer's token. Pair it again from the web app.");
    const wait = Math.min(30_000, 1000 * 2 ** Math.min(attempt, 5));
    log(`Disconnected. Reconnecting in ${Math.round(wait / 1000)} s…`);
    await sleep(wait);
  }
}
