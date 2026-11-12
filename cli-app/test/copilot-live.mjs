// Live check of the Copilot SDK adapter against YOUR Copilot account. Uses a few AI credits. Not part of `npm test`.
//   node test/copilot-live.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import WebSocket from "ws";
import { startServer, resolveSkillDir } from "../src/server.mjs";

const project = fs.mkdtempSync(path.join(os.tmpdir(), "clearspec-copilot-"));
const token = "t";
const srv = await startServer({ port: 0, skillDir: resolveSkillDir(), defaultProject: project, token });
const base = `http://127.0.0.1:${srv.port}`;
const headers = { "x-clearspec-token": token, "content-type": "application/json" };
const post = async (p, body) => (await fetch(base + p, { method: "POST", headers, body: JSON.stringify(body) })).json();

const info = await post("/api/agent-info", { agentId: "copilot", projectDir: project });
console.log("agent-info:", JSON.stringify({ source: info.source, models: info.models?.length, account: info.account, note: info.note, error: info.error }));
assert.equal(info.source, "copilot-sdk", "agent-info did not use the SDK: " + JSON.stringify(info));

const session = await post("/api/sessions", { agentId: "copilot", idea: "A tiny app that says hi", projectDir: project });
assert.ok(session.id, JSON.stringify(session));

const seen = new Set();
const result = await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error("timed out after 180 s; saw: " + [...seen].join(", "))), 180_000);
  const ws = new WebSocket(`ws://127.0.0.1:${srv.port}/ws?session=${session.id}`, { headers: { origin: base, "x-clearspec-token": token } });
  ws.on("message", async (raw) => {
    const m = JSON.parse(raw.toString());
    for (const e of m.type === "hello" ? m.events : [m]) {
      seen.add(e.type);
      if (e.type === "approval") { console.log("approval asked:", e.title); await post(`/api/sessions/${session.id}/answer`, { id: e.id, value: "allow" }); }
      if (e.type === "error") { clearTimeout(timer); reject(new Error("run error: " + e.message)); }
      if (e.type === "question") { clearTimeout(timer); console.log("question reached the UI:", e.questions[0].question); resolve("question"); }
      if (e.type === "status" && e.state === "idle") { clearTimeout(timer); resolve("idle"); }
    }
  });
});
console.log("events seen:", [...seen].join(", "), "| ended with:", result);
assert.ok(seen.has("text-delta") || seen.has("text"), "no assistant text streamed");
await post(`/api/sessions/${session.id}/stop`, {});
srv.close();
await new Promise((r) => setTimeout(r, 1500));
try { fs.rmSync(project, { recursive: true, force: true }); } catch { /* still in use on Windows */ }
console.log("copilot-live: ok");
process.exit(0);
