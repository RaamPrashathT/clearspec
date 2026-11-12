// Smoke test: engine + ACP adapter + ask_user bridge, against the mock ACP agent (no tokens, no real CLI).
// Run: npm test
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";
import { startServer, resolveSkillDir } from "../src/server.mjs";
import { listAgents } from "../src/agents.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const skillDir = resolveSkillDir();
assert.ok(skillDir, "skill folder not found");

// The registry must list the four agents the web app offers.
const ids = listAgents().map((a) => a.id);
for (const id of ["claude", "codex", "copilot", "cursor"]) assert.ok(ids.includes(id), `registry is missing ${id}`);

const project = fs.mkdtempSync(path.join(os.tmpdir(), "clearspec-smoke-"));
const token = "test-token";
const srv = await startServer({ port: 0, skillDir, defaultProject: project, token });
const base = `http://127.0.0.1:${srv.port}`;
const headers = { "x-clearspec-token": token, "content-type": "application/json" };
const post = async (p, body) => (await fetch(base + p, { method: "POST", headers, body: JSON.stringify(body) })).json();

const session = await post("/api/sessions", {
  agentId: "custom",
  customCommand: `node ${JSON.stringify(path.join(here, "mock-acp-agent.mjs"))}`,
  idea: "a tiny reminder app",
  projectDir: project,
});
assert.ok(session.id, `session not created: ${JSON.stringify(session)}`);

const events = [];
let answered = false, confirmed = false;
const done = new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error("timed out; events: " + events.map((e) => e.type).join(","))), 60_000);
  const ws = new WebSocket(`ws://127.0.0.1:${srv.port}/ws?session=${session.id}`, { headers: { origin: base, "x-clearspec-token": token } });
  ws.on("message", async (raw) => {
    const m = JSON.parse(raw.toString());
    for (const e of m.type === "hello" ? m.events : [m]) {
      events.push(e);
      if (e.type === "approval") await post(`/api/sessions/${session.id}/answer`, { id: e.id, value: e.options?.[0]?.id ?? e.options?.[0]?.optionId });
      if (e.type === "question" && !answered) {
        answered = true;
        const answers = Object.fromEntries(e.questions.map((q) => [q.question, q.options[0].label]));
        await post(`/api/sessions/${session.id}/answer`, { id: e.id, value: answers });
      }
      if (e.type === "status" && e.state === "idle" && answered && !confirmed) { confirmed = true; await post(`/api/sessions/${session.id}/message`, { text: "yes" }); } // the skill's confirm gate
      else if (e.type === "status" && e.state === "idle" && confirmed) setTimeout(() => { clearTimeout(timer); ws.close(); resolve(); }, 2000); // let the output scan catch up
      if (e.type === "status" && e.state === "error") { clearTimeout(timer); reject(new Error("run errored: " + e.detail)); }
    }
  });
});

await done;
assert.ok(events.some((e) => e.type === "question"), "agent never asked a question through ask_user");
assert.ok(events.some((e) => e.type === "outputs" && e.outputs.some((o) => o.requirements)), "no REQUIREMENTS.md was reported");
assert.ok(fs.existsSync(path.join(project, "clearspec", "mock-spec", "REQUIREMENTS.md")), "REQUIREMENTS.md not written under clearspec/");

srv.close();
await new Promise((r) => setTimeout(r, 500));
try { fs.rmSync(project, { recursive: true, force: true }); } catch { /* the agent may still hold the folder on Windows */ }
console.log("smoke: ok (registry, engine, ACP adapter, ask_user bridge, outputs)");
process.exit(0);
