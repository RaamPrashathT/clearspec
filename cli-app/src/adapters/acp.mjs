// Any agent that speaks the Agent Client Protocol (JSON-RPC 2.0, newline-delimited, over stdio).
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isWin } from "../agents.mjs";
import { buildKickoff, formatAnswers, extractQuestionBlock, withReminder } from "../prompt.mjs";

const BRIDGE = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "mcp-bridge.mjs");

export class AcpAdapter {
  constructor(session, { skillDir, apiKey, command, args, appUrl, token }) {
    this.s = session;
    this.skillDir = skillDir;
    this.apiKey = apiKey;
    this.command = command;
    this.args = args;
    this.appUrl = appUrl;
    this.token = token;
    this.nextId = 1;
    this.calls = new Map();
    this.queue = [];      // user messages waiting for the current turn to end
    this.turnActive = false;
    this.msgSeq = 0;
    this.turnText = "";
    this.askedThisTurn = false;
  }

  async start() {
    const s = this.s;
    const env = { ...process.env };
    if (s.authMode === "apiKey" && s.agent.apiKeyEnv) env[s.agent.apiKeyEnv] = this.apiKey;

    s.emitEvent({ type: "text", role: "system", id: "launch", text: `Launching \`${[this.command, ...this.args].join(" ")}\`` });
    this.proc = spawn(this.command, this.args, { cwd: s.projectDir, env, shell: isWin, stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
    this.proc.on("error", (err) => this.fail(`Could not start "${this.command}": ${err.message}. Is it installed and on your PATH?`, "not-installed"));
    this.proc.on("exit", (code) => {
      for (const { reject } of this.calls.values()) reject(new Error(`agent exited (code ${code})`));
      this.calls.clear();
      if (!["done", "stopped", "error"].includes(s.state)) this.fail(`The agent process exited (code ${code}).${this.stderrTail ? "\n" + this.stderrTail : ""}`);
    });
    this.stderrTail = "";
    this.seenErrors = new Set();
    this.proc.stderr.on("data", (d) => {
      const text = d.toString();
      this.stderrTail = (this.stderrTail + text).slice(-4000);
      this.scanStderr(text);
    });
    // Watchdog: a turn with no agent output for a minute usually means an error the agent only logged.
    this.lastActivity = Date.now();
    this.watchdog = setInterval(() => this.checkStall(), Math.min(10_000, Number(process.env.CLEARSPEC_STALL_MS) || 10_000));

    let buf = "";
    this.proc.stdout.on("data", (chunk) => {
      buf += chunk.toString();
      let nl;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        let msg;
        try { msg = JSON.parse(line); } catch { this.scanStderr(line); continue; } // agents sometimes log to stdout
        this.lastActivity = Date.now();
        this.stallShown = false;
        this.onMessage(msg);
      }
    });

    try {
      const init = await this.request("initialize", {
        protocolVersion: 1,
        // session.notices lets agents send errors and warnings (e.g. "model not available on your plan").
        clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false, session: { notices: {} } },
        clientInfo: { name: "clearspec", version: "0.1.0" },
      });
      this.agentInfo = init.agentInfo;
      let sess;
      try {
        sess = await this.newSession();
      } catch (err) {
        // auth_required: try the agent's first non-interactive auth method (e.g. an API key in env).
        if (err.code === -32000 && init.authMethods?.length) {
          const byKey = init.authMethods.find((m) => /api.?key|_key$/i.test(`${m.id} ${m.name}`));
          const method = s.authMode === "apiKey" ? byKey ?? init.authMethods[0] : init.authMethods.find((m) => m !== byKey) ?? init.authMethods[0];
          await this.request("authenticate", { methodId: method.id });
          sess = await this.newSession();
        } else throw err;
      }
      this.sessionId = sess.sessionId;
      const wanted = s.model;
      this.onConfigOptions(sess.configOptions);
      // Apply what the developer picked before the run (from the live probe of this agent).
      if (wanted && this.modelConfigId && wanted !== s.model) await this.setModel(wanted).catch(() => {});
      if (s.effort && this.effortConfigId) {
        await this.request("session/set_config_option", { sessionId: this.sessionId, configId: this.effortConfigId, value: s.effort })
          .then(() => s.emitEvent({ type: "text", role: "system", id: "effort", text: `Effort set to ${s.effort}.` }))
          .catch((err) => s.emitEvent({ type: "text", role: "system", id: "effort", text: `Couldn't set effort: ${err.message}` }));
      }
      const name = init.agentInfo?.title ?? init.agentInfo?.name ?? s.agent.name;
      s.emitEvent({ type: "text", role: "system", id: "init", text: `Connected to ${name}${init.agentInfo?.version ? " " + init.agentInfo.version : ""} over ACP.` });
      s.watchOutputs();
      this.prompt(buildKickoff({ skillDir: this.skillDir, projectDir: s.projectDir, idea: s.idea, channel: "mcp" }), { silent: true });
    } catch (err) {
      const hint = err.code === -32000 || /auth/i.test(err.message) ? `\n${s.agent.loginHint}` : "";
      this.fail(`${err.message}${hint}`, hint ? "login" : "other");
    }
  }

  newSession() {
    return this.request("session/new", {
      cwd: this.s.projectDir,
      mcpServers: [{
        name: "clearspec",
        command: process.execPath,
        args: [BRIDGE],
        env: [
          { name: "CLEARSPEC_URL", value: this.appUrl },
          { name: "CLEARSPEC_TOKEN", value: this.token },
          { name: "CLEARSPEC_SESSION", value: this.s.id },
        ],
      }],
    });
  }

  // ---------- JSON-RPC plumbing ----------

  send(obj) {
    if (this.proc?.stdin.writable) this.proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", ...obj }) + "\n");
  }

  request(method, params) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.calls.set(id, { resolve, reject });
      this.send({ id, method, params });
    });
  }

  onMessage(msg) {
    if (msg.id !== undefined && !msg.method) {
      const call = this.calls.get(msg.id);
      if (!call) return;
      this.calls.delete(msg.id);
      if (msg.error) { const e = new Error(msg.error.message); e.code = msg.error.code; call.reject(e); }
      else call.resolve(msg.result);
      return;
    }
    if (msg.method === "session/update") return this.onUpdate(msg.params.update);
    if (msg.method === "session/request_permission") return this.onPermission(msg);
    if (msg.id !== undefined) {
      // fs/* and terminal/* are not advertised; refuse anything else.
      this.send({ id: msg.id, error: { code: -32601, message: `Method not supported by clearspec: ${msg.method}` } });
    }
  }

  onUpdate(u) {
    const s = this.s;
    switch (u.sessionUpdate) {
      case "agent_message_chunk":
        if (u.content?.type === "text") {
          this.thinkId = null;
          if (!this.curId) this.curId = `a${++this.msgSeq}`;
          this.turnText += u.content.text;
          s.emitEvent({ type: "text-delta", id: this.curId, text: u.content.text });
        }
        break;
      case "agent_thought_chunk":
        if (u.content?.type === "text") {
          if (!this.thinkId) this.thinkId = `t${++this.msgSeq}`;
          s.emitEvent({ type: "thought-delta", id: this.thinkId, text: u.content.text });
        }
        break;
      case "tool_call":
        this.thinkId = null;
        this.curId = null; // text after a tool call starts a new bubble
        if (/ask_user/i.test(u.title ?? "") || Array.isArray(u.rawInput?.questions)) break; // shown as a picker instead
        s.emitEvent({ type: "tool", id: u.toolCallId, title: u.title ?? u.kind ?? "Tool", status: u.status ?? "pending" });
        break;
      case "tool_call_update":
        if (u.status) s.emitEvent({ type: "tool-update", id: u.toolCallId, status: u.status, title: u.title });
        break;
      case "config_option_update":
        this.onConfigOptions(u.configOptions);
        break;
      case "plan":
        s.emitEvent({ type: "plan", entries: u.entries });
        break;
      case "notice":
        s.emitEvent({ type: "notice", severity: u.severity ?? "info", title: u.title, description: u.description ?? "" });
        break;
      case "usage_update":
        s.updateUsage({ costUsd: u.cost?.currency === "USD" ? u.cost.amount : undefined, contextUsed: u.used, contextSize: u.size });
        break;
      default:
        break;
    }
  }

  async onPermission(msg) {
    const { toolCall, options } = msg.params;
    const choice = await this.s.approve({
      title: toolCall?.title ?? "The agent wants to run a tool",
      detail: toolCall?.rawInput ? JSON.stringify(toolCall.rawInput, null, 2).slice(0, 1500) : "",
      options: options.map((o) => ({ id: o.optionId, name: o.name, kind: o.kind })),
    });
    this.send({ id: msg.id, result: { outcome: choice ? { outcome: "selected", optionId: choice } : { outcome: "cancelled" } } });
  }

  // ---------- errors the agent only logs ----------

  /** Error-looking lines on the agent's stderr become warnings in the chat (deduped, at most 6). */
  scanStderr(text) {
    // Whole words only, so names like "mock-forbidden" or "errors-module" don't trigger it.
    const re = /(?<![\w-])(error|fatal|failed|forbidden|unauthori[sz]ed|denied|not (allowed|available|permitted|supported)|no access|quota|insufficient|billing|payment required|40[1-4]|429|rate.?limit(ed)?)(?![\w-])/i;
    const quiet = /^\s*(\[?(info|debug|trace)\b|level=(info|debug))/i; // normal log chatter
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.replace(/\x1b\[[0-9;]*m/g, "").trim();
      if (!line || line.length < 8 || quiet.test(line) || !re.test(line) || this.seenErrors.size >= 6) continue;
      const key = line.replace(/\d+/g, "#").slice(0, 120);
      if (this.seenErrors.has(key)) continue;
      this.seenErrors.add(key);
      this.s.emitEvent({ type: "notice", severity: "warning", title: "The agent reported a problem", description: line.slice(0, 600), source: "stderr" });
    }
  }

  checkStall() {
    const s = this.s;
    if (!this.turnActive || s.pending.size || this.stallShown || s.closed) return;
    if (Date.now() - this.lastActivity < (Number(process.env.CLEARSPEC_STALL_MS) || 60_000)) return;
    this.stallShown = true;
    const tail = this.stderrTail.replace(/\x1b\[[0-9;]*m/g, "").trim().split(/\r?\n/).slice(-8).join("\n");
    s.emitEvent({
      type: "notice", severity: "warning", kind: "stall",
      title: `No response from ${s.agent.name} for over a minute`,
      description: (tail ? `Last output from the agent:\n${tail}\n\n` : "") +
        "If you picked a model your plan or key can't use, stop and pick another. Otherwise it may still be working.",
    });
  }

  // ---------- model ----------

  /** ACP agents that support it report a select option with category "model". */
  onConfigOptions(list) {
    const effort = (list ?? []).find((o) => o.category === "thought_level" && o.type === "select");
    if (effort) this.effortConfigId = effort.id;
    const opt = (list ?? []).find((o) => o.category === "model" && o.type === "select");
    if (!opt) return;
    this.modelConfigId = opt.id;
    const flat = (opt.options ?? []).flatMap((x) => (Array.isArray(x.options) ? x.options : [x]));
    this.s.model = opt.currentValue;
    this.s.emitEvent({ type: "models", current: opt.currentValue, options: flat.map((o) => ({ value: o.value, name: o.name })) });
  }

  async setModel(value) {
    if (!this.modelConfigId) throw new Error("This agent doesn't let clients change its model.");
    const res = await this.request("session/set_config_option", { sessionId: this.sessionId, configId: this.modelConfigId, value });
    this.onConfigOptions(res?.configOptions);
    this.s.emitEvent({ type: "text", role: "system", id: "m" + Date.now(), text: "Model set to " + value + "." });
  }

  // ---------- turns ----------

  async prompt(text, { silent = false } = {}) {
    if (!silent) this.s.emitEvent({ type: "text", role: "user", id: `u${Date.now()}`, text });
    const wire = silent ? text : withReminder(text); // what the agent sees; the chat shows only `text`
    if (this.turnActive) { this.queue.push(wire); return; }
    this.turnActive = true;
    this.turnText = "";
    this.askedThisTurn = false;
    this.curId = null;
    this.s.setState("running");
    try {
      const res = await this.request("session/prompt", { sessionId: this.sessionId, prompt: [{ type: "text", text: wire }] });
      this.turnActive = false;
      this.s.refreshOutputs();
      if (res.stopReason === "cancelled") return this.s.setState("stopped");
      // Fallback channel: questions written as a fenced block instead of the MCP tool.
      if (!this.askedThisTurn) {
        const qs = extractQuestionBlock(this.turnText);
        if (qs) { this.askFromAgent(qs); return; }
      }
      if (this.queue.length) return this.prompt(this.queue.shift(), { silent: true });
      if (this.s.pending.size === 0) this.s.setState("idle", res.stopReason === "end_turn" ? "Your turn" : res.stopReason);
    } catch (err) {
      this.turnActive = false;
      if (this.s.state !== "stopped") this.fail(err.message);
    }
  }

  /** Called by the MCP bridge (or the fallback parser). Shows the picker, then sends the answers as the next turn. */
  async askFromAgent(questions) {
    this.askedThisTurn = true;
    const answers = await this.s.ask(questions);
    if (!answers) return;
    this.prompt(formatAnswers(questions, answers), { silent: true });
  }

  sendUser(text) {
    this.prompt(text);
  }

  fail(message, kind = "other") {
    clearInterval(this.watchdog);
    if (this.s.state === "error") return; // one failure, reported once (pending calls reject right after an exit)
    if (/not recognized|ENOENT|command not found/i.test(message + this.stderrTail)) kind = "not-installed";
    this.s.emitEvent({ type: "error", kind, message });
    this.s.setState("error", message);
  }

  stop() {
    clearInterval(this.watchdog);
    if (this.sessionId) this.send({ method: "session/cancel", params: { sessionId: this.sessionId } });
    setTimeout(() => this.proc?.kill(), 500);
  }
}
