// One clearspec run: the event log the UI replays, pending questions/approvals, and output discovery.
import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export class Session extends EventEmitter {
  constructor({ agent, authMode, projectDir, idea, model, effort, budgetUsd }) {
    super();
    this.id = randomUUID().slice(0, 8);
    this.agent = agent;
    this.authMode = authMode;
    this.projectDir = projectDir;
    this.idea = idea;
    this.model = model || "";
    this.effort = effort || "";
    this.budgetUsd = budgetUsd > 0 ? budgetUsd : null;
    this.createdAt = new Date().toISOString();
    this.events = [];
    this.state = "starting";
    this.pending = new Map(); // id -> { kind, resolve, payload }
    this.adapter = null;
    this.usage = { costUsd: 0, inputTokens: 0, outputTokens: 0 };
    this.outputsKey = "";
    this.startedAt = Date.now();
    this.preexisting = this.snapshotSpecs(); // spec folders from earlier runs stay hidden unless this run changes them
    this.watcher = null;
  }

  /** Append an event, broadcast it, keep it for replay. */
  emitEvent(ev) {
    const e = { seq: this.events.length, at: Date.now(), ...ev };
    // Merge streaming text deltas into the previous text event so replay stays small.
    const last = this.events[this.events.length - 1];
    const merged = { "text-delta": "text", "thought-delta": "thought" }[ev.type];
    if (merged && last && last.type === merged && last.id === ev.id) {
      last.text += ev.text;
    } else if (merged) {
      this.events.push({ ...e, type: merged, role: "agent" });
    } else {
      this.events.push(e);
    }
    this.emit("event", e);
  }

  setState(state, detail) {
    if (this.closed && state !== "stopped") return; // ignore late events after Stop
    this.state = state;
    this.emitEvent({ type: "status", state, detail });
  }

  /** Show questions in the UI. Resolves with { [questionText]: answer } when the developer answers. */
  ask(questions) {
    const id = randomUUID().slice(0, 8);
    return new Promise((resolve) => {
      this.pending.set(id, { kind: "question", resolve });
      this.emitEvent({ type: "question", id, questions });
      this.setState("waiting", "Waiting for your answer");
    });
  }

  /** Show an approval card. Resolves with the chosen option id (or null if cancelled). */
  approve({ title, detail, options }) {
    const id = randomUUID().slice(0, 8);
    return new Promise((resolve) => {
      this.pending.set(id, { kind: "approval", resolve });
      this.emitEvent({ type: "approval", id, title, detail, options });
      this.setState("waiting", "Waiting for your approval");
    });
  }

  resolvePending(id, value) {
    const p = this.pending.get(id);
    if (!p) return false;
    this.pending.delete(id);
    this.emitEvent({ type: p.kind === "question" ? "question-answered" : "approval-resolved", id, value });
    if (this.state === "waiting" && this.pending.size === 0) this.setState("running");
    p.resolve(value);
    return true;
  }

  cancelPending() {
    for (const [id, p] of this.pending) {
      this.emitEvent({ type: p.kind === "question" ? "question-answered" : "approval-resolved", id, value: null, cancelled: true });
      p.resolve(null);
    }
    this.pending.clear();
  }

  /** costUsd is a running total (both Claude and ACP report it that way); tokens add up per turn. */
  updateUsage({ costUsd, inputTokens = 0, outputTokens = 0, contextUsed, contextSize }) {
    if (costUsd != null) this.usage.costUsd = Math.max(this.usage.costUsd, costUsd);
    this.usage.inputTokens += inputTokens;
    this.usage.outputTokens += outputTokens;
    if (contextUsed != null) { this.usage.contextUsed = contextUsed; this.usage.contextSize = contextSize; }
    this.emitEvent({ type: "usage", ...this.usage, budgetUsd: this.budgetUsd });
    if (this.budgetUsd && this.usage.costUsd >= this.budgetUsd && !this.closed) {
      this.emitEvent({ type: "error", kind: "budget", message: "Budget reached: $" + this.usage.costUsd.toFixed(2) + " of $" + this.budgetUsd.toFixed(2) + ". The run was stopped. Start a new run with a higher budget, or with no limit." });
      this.dispose();
      this.setState("stopped", "Budget reached");
    }
  }

  // ---------- outputs on disk ----------

  get specRoot() {
    return path.join(this.projectDir, "clearspec");
  }

  /** Newest modification time of a spec folder's REQUIREMENTS.md and mockups. */
  specMtime(dir) {
    let newest = 0;
    const visit = (p, depth) => {
      let st; try { st = fs.statSync(p); } catch { return; }
      newest = Math.max(newest, st.mtimeMs);
      if (st.isDirectory() && depth > 0) for (const f of fs.readdirSync(p)) visit(path.join(p, f), depth - 1);
    };
    visit(path.join(dir, "REQUIREMENTS.md"), 0);
    visit(path.join(dir, "mockups"), 2);
    return newest;
  }

  snapshotSpecs() {
    const root = this.specRoot;
    if (!fs.existsSync(root)) return new Set();
    return new Set(fs.readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name));
  }

  /** clearspec/<name>/ folders this run created or changed, with what they contain. */
  scanOutputs() {
    const root = this.specRoot;
    if (!fs.existsSync(root)) return [];
    return fs.readdirSync(root, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith("."))
      .filter((d) => !this.preexisting.has(d.name) || this.specMtime(path.join(root, d.name)) > this.startedAt)
      .map((d) => {
        const dir = path.join(root, d.name);
        const req = path.join(dir, "REQUIREMENTS.md");
        const mockDir = path.join(dir, "mockups");
        const entry = ["index.html", "api.html", "cli.html"].find((f) => fs.existsSync(path.join(mockDir, f)));
        const screens = fs.existsSync(mockDir)
          ? fs.readdirSync(mockDir).filter((f) => f.endsWith(".html")).sort()
          : [];
        return {
          name: d.name,
          requirements: fs.existsSync(req) ? { mtime: fs.statSync(req).mtimeMs } : null,
          mockupEntry: entry ? `${d.name}/mockups/${entry}` : null,
          screens: screens.map((f) => `${d.name}/mockups/${f}`),
        };
      });
  }

  refreshOutputs() {
    const outputs = this.scanOutputs();
    const key = JSON.stringify(outputs);
    if (key !== this.outputsKey) {
      this.outputsKey = key;
      this.emitEvent({ type: "outputs", outputs });
    }
  }

  watchOutputs() {
    let timer = null;
    const kick = () => { clearTimeout(timer); timer = setTimeout(() => this.refreshOutputs(), 400); };
    try {
      fs.mkdirSync(this.specRoot, { recursive: true });
      this.watcher = fs.watch(this.specRoot, { recursive: true }, kick);
    } catch {
      this.watcher = null;
    }
    // Poll as a backstop: recursive watch is unreliable on some file systems.
    this.poll = setInterval(() => this.refreshOutputs(), 4000);
  }

  dispose() {
    this.closed = true;
    this.watcher?.close();
    clearInterval(this.poll);
    this.cancelPending();
    this.adapter?.stop?.();
  }

  summary() {
    return {
      id: this.id, agent: this.agent.id, agentName: this.agent.name, authMode: this.authMode,
      projectDir: this.projectDir, idea: this.idea, model: this.model, budgetUsd: this.budgetUsd, state: this.state, createdAt: this.createdAt, usage: this.usage,
    };
  }
}
