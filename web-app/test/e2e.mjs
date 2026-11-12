// End to end: Worker + Durable Objects + the helper + the mock ACP agent. No GitHub, no real agent, no tokens.
// Needs `npm run dev` running (with DEV_LOGIN=1 in .dev.vars) and `npm install` done in ../cli-app.
//   node test/e2e.mjs [http://127.0.0.1:8787]
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";

const here = path.dirname(fileURLToPath(import.meta.url));
const server = (process.argv[2] ?? "http://127.0.0.1:8787").replace(/\/$/, "");
const cliBin = path.join(here, "..", "..", "cli-app", "bin", "clearspec.mjs");
const mockAgent = path.join(here, "..", "..", "cli-app", "test", "mock-acp-agent.mjs");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, what, ms = 30_000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { const v = await fn(); if (v) return v; await sleep(300); }
  throw new Error(`timed out waiting for ${what}`);
}

// 1. Sign in with the dev login (localhost only).
const login = await fetch(`${server}/auth/dev-login`, { redirect: "manual" });
const sid = /sid=([^;]+)/.exec(login.headers.get("set-cookie") ?? "")?.[1];
assert.ok(sid, "dev login failed; is DEV_LOGIN=1 set in .dev.vars?");
const cookie = `sid=${sid}`;
const api = async (p, body) => {
  const res = await fetch(server + p, { method: body === undefined ? "GET" : "POST", headers: { cookie, "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${p}: ${data.error ?? res.status}`);
  return data;
};
assert.equal((await api("/api/me")).login, "dev");

// 2. Pair a computer with the real helper (isolated home folder so it can't touch your own pairing).
const pair = await api("/api/connectors/pair", {});
assert.match(pair.command, /npx -y clearspec@[\d.]+ connect [A-Z0-9]{4}-[A-Z0-9]{4} --server /);
const home = fs.mkdtempSync(path.join(os.tmpdir(), "clearspec-e2e-home-"));
const project = fs.mkdtempSync(path.join(os.tmpdir(), "clearspec-e2e-proj-"));
const helper = spawn(process.execPath, [cliBin, "connect", pair.code, "--server", server, "--project", project], {
  env: { ...process.env, USERPROFILE: home, HOME: home }, stdio: ["ignore", "pipe", "pipe"],
});
let helperLog = "";
helper.stdout.on("data", (d) => (helperLog += d));
helper.stderr.on("data", (d) => (helperLog += d));

try {
  const computer = await until(async () => (await api("/api/connectors")).find((c) => c.online), "the helper to come online");

  // 3. The helper reports the agents installed on that computer; the four we ship must all be listed.
  const cfg = await api(`/api/connectors/${computer.id}/config`, {});
  const ids = cfg.agents.map((a) => a.id);
  for (const id of ["claude", "codex", "copilot", "cursor"]) assert.ok(ids.includes(id), `helper does not list ${id}`);
  console.log("installed here:", cfg.agents.filter((a) => a.installed).map((a) => a.id).join(", ") || "(none)");

  // 4. Start a run on the mock ACP agent through the hosted path.
  const run = await api("/api/sessions", {
    connectorId: computer.id, agentId: "custom", customCommand: `node ${JSON.stringify(mockAgent)}`,
    idea: "a tiny reminder app", projectDir: project,
  });
  assert.ok(run.id);

  // 5. Watch it like the browser does; answer the question, confirm, wait for the spec.
  const events = [];
  let answered = false, confirmed = false;
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("run timed out; events: " + events.map((e) => e.type).join(","))), 60_000);
    const ws = new WebSocket(`${server.replace(/^http/, "ws")}/ws?session=${run.id}`, { headers: { cookie } });
    ws.on("message", async (raw) => {
      const m = JSON.parse(raw.toString());
      for (const e of m.type === "hello" ? m.events : [m]) {
        events.push(e);
        if (e.type === "approval") await api(`/api/sessions/${run.id}/answer`, { id: e.id, value: e.options?.[0]?.id ?? e.options?.[0]?.optionId });
        if (e.type === "question" && !answered) {
          answered = true;
          await api(`/api/sessions/${run.id}/answer`, { id: e.id, value: Object.fromEntries(e.questions.map((q) => [q.question, q.options[0].label])) });
        }
        if (e.type === "status" && e.state === "idle" && answered && !confirmed) { confirmed = true; await api(`/api/sessions/${run.id}/message`, { text: "yes" }); }
        else if (e.type === "status" && e.state === "idle" && confirmed) setTimeout(() => { clearTimeout(timer); ws.close(); resolve(); }, 2500);
        if (e.type === "status" && e.state === "error") { clearTimeout(timer); reject(new Error("run errored: " + e.detail)); }
      }
    });
    ws.on("error", reject);
  });

  assert.ok(events.some((e) => e.type === "question"), "no question reached the browser");
  const out = events.filter((e) => e.type === "outputs").pop();
  assert.ok(out?.outputs?.some((o) => o.requirements), "no REQUIREMENTS.md reported");

  // 6. The spec files were uploaded to the run's Durable Object and are served back.
  const spec = await fetch(`${server}/files/${run.id}/mock-spec/REQUIREMENTS.md`, { headers: { cookie } });
  assert.equal(spec.status, 200);
  assert.match(await spec.text(), /Mock spec/);
  const list = await api("/api/sessions");
  assert.ok(list.some((r) => r.id === run.id), "run is missing from the runs list");

  // 7. Other users' data stays private: no cookie, no access.
  assert.equal((await fetch(`${server}/api/connectors`)).status, 401);
  assert.equal((await fetch(`${server}/files/${run.id}/mock-spec/REQUIREMENTS.md`)).status, 401);

  console.log("e2e: ok (sign-in, pairing, helper, agent list, ACP run, questions, files, auth)");
} catch (err) {
  console.error("e2e failed:", err.message, "\n--- helper log ---\n" + helperLog);
  process.exitCode = 1;
} finally {
  helper.kill();
  await sleep(500);
  for (const d of [home, project]) { try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* still in use on Windows */ } }
  process.exit(process.exitCode ?? 0);
}
