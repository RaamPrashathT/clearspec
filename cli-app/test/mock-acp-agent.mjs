#!/usr/bin/env node
// Fake ACP agent for testing the app without spending tokens.
// Use it as "Custom ACP agent" with: node <abs path>/test/mock-acp-agent.mjs
// Turn 1: streams text, runs a tool call, asks for a permission, calls the injected ask_user MCP tool, ends the turn.
// Turn 2 (the answers): writes clearspec/mock-spec/REQUIREMENTS.md and a one-screen mockup, then ends.
import fs from "node:fs";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

let buf = "", nextId = 1000, cwd = process.cwd(), mcp = null, turn = 0;
const pending = new Map();
const out = (m) => process.stdout.write(JSON.stringify({ jsonrpc: "2.0", ...m }) + "\n");
const req = (method, params) => new Promise((resolve) => { const id = nextId++; pending.set(id, resolve); out({ id, method, params }); });
const update = (sessionId, u) => out({ method: "session/update", params: { sessionId, update: u } });
const say = (sid, text) => { for (const w of text.match(/.{1,12}/gs)) update(sid, { sessionUpdate: "agent_message_chunk", content: { type: "text", text: w } }); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let model = "mock-large", effort = "medium";
const configOptions = () => [
  { id: "model", name: "Model", category: "model", type: "select", currentValue: model,
    options: [{ value: "mock-large", name: "Mock Large" }, { value: "mock-small", name: "Mock Small", description: "Cheaper" }, { value: "mock-forbidden", name: "Mock Forbidden", description: "Simulates a model your plan cannot use" }] },
  { id: "effort", name: "Effort", category: "thought_level", type: "select", currentValue: effort,
    options: [{ value: "low", name: "Low" }, { value: "medium", name: "Medium" }, { value: "high", name: "High" }] },
];

process.stdin.on("data", async (d) => {
  buf += d;
  let nl;
  while ((nl = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, nl); buf = buf.slice(nl + 1);
    if (line.trim()) handle(JSON.parse(line)).catch((e) => process.stderr.write(String(e.stack)));
  }
});

async function handle(m) {
  if (m.id !== undefined && !m.method) { pending.get(m.id)?.(m.result); pending.delete(m.id); return; }
  if (m.method === "initialize") return out({ id: m.id, result: { protocolVersion: 1, agentCapabilities: {}, authMethods: [], agentInfo: { name: "mock-agent", title: "Mock ACP agent", version: "0.0.1" } } });
  if (m.method === "session/new") {
    cwd = m.params.cwd;
    const s = m.params.mcpServers.find((x) => x.name === "clearspec");
    if (s) {
      mcp = new Client({ name: "mock", version: "0" });
      await mcp.connect(new StdioClientTransport({ command: s.command, args: s.args, env: { ...process.env, ...Object.fromEntries(s.env.map((e) => [e.name, e.value])) } }));
    }
    return out({ id: m.id, result: { sessionId: "mock-1", configOptions: configOptions() } });
  }
  if (m.method === "session/set_config_option") {
    if (m.params.configId === "model") model = m.params.value;
    if (m.params.configId === "effort") effort = m.params.value;
    process.stderr.write(`set ${m.params.configId}=${m.params.value}\n`);
    return out({ id: m.id, result: { configOptions: configOptions() } });
  }
  if (m.method === "session/cancel") return;
  if (m.method === "session/prompt") {
    const sid = m.params.sessionId;
    turn++;
    if (model === "mock-forbidden") {
      // Like a provider rejecting a model the plan can't use: log it, send a notice, never answer.
      process.stderr.write("INFO starting turn\nERROR 403 Forbidden: model mock-forbidden is not available on your plan\n");
      update(sid, { sessionUpdate: "notice", severity: "error", title: "Model not available", description: "mock-forbidden requires a paid plan." });
      return;
    }
    if (turn === 1) {
      for (const t of ["The idea is small. ", "I should check the repo first, ", "then ask who uses it."]) { update(sid, { sessionUpdate: "agent_thought_chunk", content: { type: "text", text: t } }); await sleep(400); }
      await sleep(1500);
      say(sid, "**Context brief**\n\nWhat I found\n- Repo: empty\n- My read: a mock spec · confidence 50%\n");
      update(sid, { sessionUpdate: "tool_call", toolCallId: "t1", title: "Read SKILL.md", kind: "read", status: "in_progress" });
      await sleep(300);
      update(sid, { sessionUpdate: "tool_call_update", toolCallId: "t1", status: "completed" });
      const perm = await req("session/request_permission", {
        sessionId: sid,
        toolCall: { toolCallId: "t2", title: "Run node check.mjs", rawInput: { command: "node check.mjs clearspec/mock-spec" } },
        options: [{ optionId: "ok", name: "Allow once", kind: "allow_once" }, { optionId: "no", name: "Reject", kind: "reject_once" }],
      });
      say(sid, `\nPermission outcome: ${JSON.stringify(perm.outcome)}\n`);
      const r = await mcp.callTool({ name: "ask_user", arguments: { questions: [
        { question: "Who uses this most?", header: "User", multiSelect: false, options: [{ label: "Just me (Recommended)", description: "Single user" }, { label: "A team", description: "Shared" }] },
        { question: "Which platforms are out of Phase 1?", header: "Scope", multiSelect: true, options: [{ label: "macOS", description: "Skip mac", preview: "+------+\n| mac  |\n+------+" }, { label: "Linux", description: "Skip linux" }, { label: "Windows", description: "Skip win" }] },
      ] } });
      process.stderr.write("ask_user returned: " + JSON.stringify(r.content) + "\n");
      return out({ id: m.id, result: { stopReason: "end_turn" } });
    }
    const text = m.params.prompt.map((p) => p.text).join("\n");
    update(sid, { sessionUpdate: "usage_update", used: 42000, size: 200000, cost: { amount: 0.42 * turn, currency: "USD" } });
    if (/explain this question first/i.test(text)) {
      say(sid, "Sure. **Example:** Ana uses it alone on her laptop; a team would mean shared reminders. Asking again:");
      await mcp.callTool({ name: "ask_user", arguments: { questions: [
        { question: "Who uses this most?", header: "User", multiSelect: false, options: [{ label: "Just me (Recommended)", description: "Single user" }, { label: "A team", description: "Shared" }] },
      ] } });
      return out({ id: m.id, result: { stopReason: "end_turn" } });
    }
    if (!/^yes/i.test(text.trim()) && turn < 4) {
      say(sid, "Restate: a mock tool for one user.\n\nAssumptions:\n- A-1: hourly interval\n- A-2: no sound\n\nConfirm, or name the ones to change.");
      return out({ id: m.id, result: { stopReason: "end_turn" } });
    }
    for (const [id, title] of [["t3", "Write clearspec/mock-spec/REQUIREMENTS.md"], ["t4", "Write clearspec/mock-spec/mockups/index.html"], ["t5", "Run node check.mjs clearspec/mock-spec"]]) {
      update(sid, { sessionUpdate: "tool_call", toolCallId: id, title, status: "in_progress" });
      await sleep(250);
      update(sid, { sessionUpdate: "tool_call_update", toolCallId: id, status: "completed" });
    }
    const dir = path.join(cwd, "clearspec", "mock-spec");
    fs.mkdirSync(path.join(dir, "mockups"), { recursive: true });
    fs.writeFileSync(path.join(dir, "REQUIREMENTS.md"), `# Mock spec\n\nStatus: Confirmed\n\n## Answers received\n\n\`\`\`\n${text}\n\`\`\`\n`);
    fs.writeFileSync(path.join(dir, "mockups", "index.html"), "<!doctype html><title>Mock</title><h1>Mock mockup index</h1><p>It works.</p>");
    say(sid, "Wrote `clearspec/mock-spec/REQUIREMENTS.md` and a mockup. Done.");
    return out({ id: m.id, result: { stopReason: "end_turn" } });
  }
  if (m.id !== undefined) out({ id: m.id, error: { code: -32601, message: "not implemented" } });
}
