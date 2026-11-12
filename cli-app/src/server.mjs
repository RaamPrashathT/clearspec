// The local engine: a headless HTTP + WebSocket server on 127.0.0.1, driven only by `clearspec connect`
// (src/remote.mjs). There is no UI here; the UI is the hosted web app. Every call needs the launch token.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { WebSocketServer } from "ws";
import { describeAgents, getAgent, splitCommand, launchCommand, which } from "./agents.mjs";
import { pickFolder } from "./folder-picker.mjs";
import { claudeInfo, acpInfo, copilotInfo } from "./agent-info.mjs";
import { Session } from "./session.mjs";
import { ClaudeSdkAdapter } from "./adapters/claude-sdk.mjs";
import { AcpAdapter } from "./adapters/acp.mjs";
import { CopilotSdkAdapter } from "./adapters/copilot-sdk.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

export function resolveSkillDir(explicit) {
  const candidates = [
    explicit,
    process.env.CLEARSPEC_SKILL_DIR,
    path.join(ROOT, "skill"),        // bundled copy (npm run sync-skill)
    path.join(ROOT, "..", "skill"),  // a checkout of this repo
  ].filter(Boolean);
  return candidates.find((d) => fs.existsSync(path.join(d, "SKILL.md"))) ?? null;
}

export function startServer({ port = 0, skillDir, defaultProject = process.cwd(), token: fixedToken } = {}) {
  const token = fixedToken || randomBytes(18).toString("base64url");
  const sessions = new Map();

  const tokenOk = (t) => {
    if (!t) return false;
    const a = Buffer.from(String(t)), b = Buffer.from(token);
    return a.length === b.length && timingSafeEqual(a, b);
  };
  const authed = (req) => tokenOk(req.headers["x-clearspec-token"]);

  const send = (res, code, body) => {
    res.writeHead(code, { "content-type": "application/json", "cache-control": "no-store" });
    res.end(JSON.stringify(body));
  };
  const readJson = (req) => new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => { data += c; if (data.length > 2e6) req.destroy(); });
    req.on("end", () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); } });
  });

  /** Which agent, folder and launch command a request means. Shared by run start and the info probe. */
  function resolveTarget(body) {
    const agent = getAgent(body.agentId);
    if (!agent) throw new Error("Choose an agent.");
    const projectDir = path.resolve(String(body.projectDir || defaultProject));
    if (!fs.existsSync(projectDir) || !fs.statSync(projectDir).isDirectory()) throw new Error(`Folder not found: ${projectDir}`);
    let command = null, args = [];
    if (agent.id === "custom") {
      const parts = splitCommand(String(body.customCommand ?? ""));
      if (!parts.length) throw new Error("Enter the agent's ACP launch command.");
      [command, ...args] = parts;
    } else if (agent.kind !== "claude-sdk") {
      ({ command, args } = launchCommand(agent));
    }
    return { agent, projectDir, command, args };
  }

  function createSession(body) {
    const { agent, projectDir, command, args } = resolveTarget(body);
    const idea = String(body.idea ?? "").trim();
    if (!idea) throw new Error("Describe the idea first.");

    const s = new Session({ agent, authMode: "cli", projectDir, idea, model: String(body.model ?? ""), effort: String(body.effort ?? ""), budgetUsd: Number(body.budgetUsd) || 0 });
    const appUrl = `http://127.0.0.1:${server.address().port}`;
    if (agent.kind === "claude-sdk") {
      s.adapter = new ClaudeSdkAdapter(s, { skillDir });
    } else if (agent.kind === "copilot-sdk") {
      s.adapter = new CopilotSdkAdapter(s, { skillDir });
    } else {
      s.adapter = new AcpAdapter(s, { skillDir, command, args, appUrl, token });
    }
    sessions.set(s.id, s);
    const failed = (err) => { s.emitEvent({ type: "error", message: err.message }); s.setState("error", err.message); };
    s.adapter.start().catch((err) => {
      // Copilot without its SDK: fall back to the Copilot CLI over ACP, if that is installed.
      if (err.sdkUnavailable && agent.kind === "copilot-sdk" && which(command)) {
        s.emitEvent({ type: "text", role: "system", id: "fallback", text: "The Copilot SDK isn't available here; using the Copilot CLI over ACP instead." });
        s.adapter = new AcpAdapter(s, { skillDir, command, args, appUrl, token });
        s.adapter.start().catch(failed);
      } else failed(err);
    });
    return s;
  }

  const server = http.createServer(async (req, res) => {
    const p = new URL(req.url, "http://x").pathname;
    try {
      // Bridge from the injected MCP server (ask_user).
      if (p === "/internal/ask" && req.method === "POST") {
        if (!authed(req)) return send(res, 401, { error: "token" });
        const body = await readJson(req);
        const s = sessions.get(body.session);
        if (!s || !s.adapter?.askFromAgent) return send(res, 404, { error: "session" });
        s.adapter.askFromAgent(body.questions);
        return send(res, 200, { ok: true });
      }

      if (!authed(req)) return send(res, 401, { error: "unauthorized" });

      if (p === "/api/config") {
        const body = req.method === "POST" ? await readJson(req) : {};
        return send(res, 200, { skillDir, defaultProject, agents: await describeAgents({ fresh: Boolean(body.fresh) }) });
      }
      if (p === "/api/agent-info" && req.method === "POST") {
        const body = await readJson(req);
        try {
          const t = resolveTarget(body);
          if (t.agent.kind === "claude-sdk") return send(res, 200, await claudeInfo({ authMode: "cli", cwd: t.projectDir }));
          if (t.agent.kind === "copilot-sdk") {
            try { return send(res, 200, await copilotInfo()); } catch (err) { if (!err.sdkUnavailable) throw err; }
          }
          return send(res, 200, await acpInfo({ command: t.command, args: t.args, cwd: t.projectDir, env: { ...process.env } }));
        } catch (err) { return send(res, 200, { error: err.message, models: [], limits: [] }); }
      }
      if (p === "/api/pick-folder" && req.method === "POST") {
        const body = await readJson(req);
        try { return send(res, 200, await pickFolder(String(body.start ?? ""))); }
        catch (err) { return send(res, 500, { error: err.message }); }
      }
      if (p === "/api/sessions" && req.method === "POST") {
        const body = await readJson(req);
        try { return send(res, 200, createSession(body).summary()); }
        catch (err) { return send(res, 400, { error: err.message }); }
      }

      const sm = /^\/api\/sessions\/([^/]+)\/(stop|message|answer|model)$/.exec(p);
      if (sm && req.method === "POST") {
        const s = sessions.get(sm[1]);
        if (!s) return send(res, 404, { error: "session" });
        const body = await readJson(req);
        if (sm[2] === "stop") { s.dispose(); s.setState("stopped"); }
        if (sm[2] === "model") { try { await s.adapter.setModel(String(body.value ?? "")); } catch (err) { return send(res, 400, { error: err.message }); } }
        if (sm[2] === "message") s.adapter.sendUser(String(body.text ?? ""));
        if (sm[2] === "answer" && !s.resolvePending(body.id, body.value)) return send(res, 409, { error: "already answered" });
        return send(res, 200, { ok: true });
      }

      send(res, 404, { error: "not found" });
    } catch (err) {
      send(res, 500, { error: err.message });
    }
  });

  // Live event stream for one session: /ws?session=<id>. Replays history, then streams. Used by the relay in remote.mjs.
  const wss = new WebSocketServer({ noServer: true });
  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url, "http://x");
    const origin = req.headers.origin ?? "";
    const s = sessions.get(url.searchParams.get("session"));
    if (url.pathname !== "/ws" || !authed(req) || !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin) || !s) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      ws.send(JSON.stringify({ type: "hello", session: s.summary(), events: s.events }));
      const onEvent = (e) => ws.readyState === 1 && ws.send(JSON.stringify(e));
      s.on("event", onEvent);
      ws.on("close", () => s.off("event", onEvent));
    });
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      const actual = server.address().port;
      resolve({ server, port: actual, close: () => { for (const s of sessions.values()) s.dispose(); server.close(); } });
    });
  });
}
