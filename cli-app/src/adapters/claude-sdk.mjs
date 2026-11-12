// Claude Code through the Claude Agent SDK. Uses the developer's Claude Code login, or an API key.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { buildKickoff, withReminder } from "../prompt.mjs";
import { normalizeLimits } from "../agent-info.mjs";

// Auto-approved: reading, research, and file edits inside the project (acceptEdits).
const AUTO_ALLOW = new Set(["Read", "Glob", "Grep", "WebSearch", "WebFetch", "TodoWrite", "Task", "Agent", "Skill", "Write", "Edit", "MultiEdit", "NotebookEdit"]);

/** Async queue that feeds user messages into the SDK's streaming-input mode. */
class Inbox {
  constructor() { this.items = []; this.waiters = []; this.closed = false; }
  push(v) { const w = this.waiters.shift(); if (w) w({ value: v, done: false }); else this.items.push(v); }
  close() { this.closed = true; for (const w of this.waiters) w({ value: undefined, done: true }); }
  [Symbol.asyncIterator]() {
    return {
      next: () => this.items.length ? Promise.resolve({ value: this.items.shift(), done: false })
        : this.closed ? Promise.resolve({ value: undefined, done: true })
        : new Promise((r) => this.waiters.push(r)),
    };
  }
}

const userMsg = (text) => ({ type: "user", message: { role: "user", content: text }, parent_tool_use_id: null, session_id: "" });

export class ClaudeSdkAdapter {
  constructor(session, { skillDir, apiKey }) {
    this.s = session;
    this.skillDir = skillDir;
    this.apiKey = apiKey;
    this.inbox = new Inbox();
    this.abort = new AbortController();
    this.msgSeq = 0;
  }

  async start() {
    const s = this.s;
    const env = { ...process.env };
    if (s.authMode === "apiKey") {
      env.ANTHROPIC_API_KEY = this.apiKey;
      // Key only: an empty config dir stops Claude Code from falling back to a saved claude.ai login on this machine.
      env.CLAUDE_CONFIG_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "clearspec-claude-"));
    }
    else delete env.ANTHROPIC_API_KEY; // CLI-login mode: never fall back to a stray key

    const skillScripts = this.skillDir.replaceAll("\\", "/") + "/scripts/";
    const kickoff = buildKickoff({ skillDir: this.skillDir, projectDir: s.projectDir, idea: s.idea, channel: "ask-user-question" });
    s.emitEvent({ type: "text", role: "system", id: "kickoff", text: "Started clearspec with Claude Code." });
    this.inbox.push(userMsg(kickoff));

    const q = query({
      prompt: this.inbox,
      options: {
        cwd: s.projectDir,
        ...(s.model ? { model: s.model } : {}),
        ...(s.effort ? { effort: s.effort } : {}),
        // Show summarized reasoning in the chat (Claude decides when to think; default display omits it).
        thinking: { type: "adaptive", display: "summarized" },
        ...(s.budgetUsd ? { maxBudgetUsd: s.budgetUsd } : {}),
        env,
        abortController: this.abort,
        permissionMode: "acceptEdits",
        includePartialMessages: true,
        additionalDirectories: [this.skillDir],
        toolConfig: { askUserQuestion: { previewFormat: "markdown" } },
        systemPrompt: { type: "preset", preset: "claude_code" },
        canUseTool: async (toolName, input) => {
          if (toolName === "AskUserQuestion") {
            const answers = await s.ask(input.questions);
            if (!answers) return { behavior: "deny", message: "The developer dismissed the question." };
            return { behavior: "allow", updatedInput: { questions: input.questions, answers } };
          }
          if (AUTO_ALLOW.has(toolName)) return { behavior: "allow", updatedInput: input };
          if (toolName === "Bash" && /^\s*node\s+/.test(input.command ?? "") && input.command.replaceAll("\\", "/").includes(skillScripts)) {
            return { behavior: "allow", updatedInput: input };
          }
          const choice = await s.approve({
            title: `Claude wants to use ${toolName}`,
            detail: toolName === "Bash" ? input.command : JSON.stringify(input, null, 2).slice(0, 1500),
            options: [{ id: "allow", name: "Allow", kind: "allow_once" }, { id: "deny", name: "Deny", kind: "reject_once" }],
          });
          return choice === "allow" ? { behavior: "allow", updatedInput: input } : { behavior: "deny", message: "The developer denied this action." };
        },
      },
    });

    this.query = q;
    // Live model list for this account, and plan usage; neither costs tokens.
    q.supportedModels().then((list) => { this.models = list; this.emitModels(s.model); }).catch(() => {});
    this.refreshLimits();
    s.watchOutputs();
    s.setState("running");
    try {
      for await (const m of q) this.handle(m);
      s.setState("done");
    } catch (err) {
      if (this.abort.signal.aborted) s.setState("stopped");
      else { s.emitEvent({ type: "error", kind: errorKind(err), message: friendlyError(err) }); s.setState("error", friendlyError(err)); }
    }
  }

  handle(m) {
    const s = this.s;
    if (m.type === "stream_event" && !m.parent_tool_use_id) {
      const ev = m.event;
      if (ev.type === "message_start") this.curId = `c${++this.msgSeq}`;
      if (ev.type === "content_block_start" && ev.content_block?.type === "thinking") this.thinkId = `t${++this.msgSeq}`;
      if (ev.type === "content_block_delta" && ev.delta?.type === "text_delta") {
        s.emitEvent({ type: "text-delta", id: this.curId, text: ev.delta.text });
      }
      if (ev.type === "content_block_delta" && ev.delta?.type === "thinking_delta" && ev.delta.thinking) {
        s.emitEvent({ type: "thought-delta", id: this.thinkId ?? `t${this.msgSeq}`, text: ev.delta.thinking });
      }
      return;
    }
    if (m.type === "assistant" && m.error && !this.errorShown?.has(m.error)) {
      // e.g. model_not_found when the plan can't use the chosen model, billing_error, rate_limit.
      (this.errorShown ??= new Set()).add(m.error);
      const text = (m.message?.content ?? []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
      const titles = { model_not_found: "This model isn't available on your plan or key", billing_error: "Billing problem on this account", rate_limit: "Rate limited", authentication_failed: "Sign-in failed", overloaded: "The service is overloaded", invalid_request: "The request was rejected" };
      s.emitEvent({ type: "notice", severity: "error", kind: "stall", title: titles[m.error] ?? `Error: ${m.error}`, description: (text ? text + "\n\n" : "") + (m.error === "model_not_found" ? "Switch the model in the box below and send a message to retry, or stop the run." : "") });
    }
    if (m.type === "assistant") {
      for (const block of m.message.content ?? []) {
        if (block.type === "tool_use" && block.name !== "AskUserQuestion") {
          s.emitEvent({ type: "tool", id: block.id, title: toolTitle(block), status: "in_progress", sub: Boolean(m.parent_tool_use_id) });
        }
      }
      return;
    }
    if (m.type === "user" && Array.isArray(m.message?.content)) {
      for (const block of m.message.content) {
        if (block.type === "tool_result") s.emitEvent({ type: "tool-update", id: block.tool_use_id, status: block.is_error ? "failed" : "completed" });
      }
      return;
    }
    if (m.type === "result") {
      s.updateUsage({ costUsd: m.total_cost_usd, inputTokens: m.usage?.input_tokens ?? 0, outputTokens: m.usage?.output_tokens ?? 0 });
      s.setState("idle", m.subtype === "success" ? "Your turn" : m.subtype);
      s.refreshOutputs();
      this.refreshLimits();
    }
    if (m.type === "rate_limit_event") {
      const i = m.rate_limit_info ?? {};
      if (i.status === "allowed_warning" || i.status === "rejected") {
        const when = i.resetsAt ? new Date(i.resetsAt * 1000).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "later";
        s.emitEvent({ type: "text", role: "system", id: `rl${Date.now()}`, text: i.status === "rejected" ? `Plan limit reached. It resets at ${when}.` : `Close to your plan limit (${Math.round((i.utilization ?? 0) * (i.utilization <= 1 ? 100 : 1))}%). Resets at ${when}.` });
      }
      this.refreshLimits();
    }
    if (m.type === "system" && m.subtype === "init") {
      s.emitEvent({ type: "text", role: "system", id: "init", text: `Model: ${m.model}${s.effort ? ` · effort: ${s.effort}` : ""} · sign-in: ${m.apiKeySource === "none" ? "Claude Code login" : m.apiKeySource}` });
    }
  }

  emitModels(current) {
    if (!this.models) return;
    this.s.emitEvent({ type: "models", current: current || "default", options: this.models.map((m) => ({ value: m.value, name: m.displayName, description: m.description })) });
  }

  /** Plan usage windows (5-hour, weekly). Empty for API keys. Experimental SDK call, so failures are ignored. */
  async refreshLimits() {
    try {
      const u = await this.query.usage_EXPERIMENTAL_MAY_CHANGE_DO_NOT_RELY_ON_THIS_API_YET({ skipBehaviors: true });
      const limits = normalizeLimits(u);
      if (limits.length) this.s.emitEvent({ type: "limits", limits });
    } catch {}
  }

  /** Switch model mid-run; applies from the next turn. */
  async setModel(value) {
    await this.query.setModel(value && value !== "default" ? value : undefined);
    this.s.model = value;
    this.emitModels(value);
    this.s.emitEvent({ type: "text", role: "system", id: "m" + Date.now(), text: "Model set to " + (value || "your Claude Code default") + "." });
  }

  sendUser(text) {
    this.s.emitEvent({ type: "text", role: "user", id: `u${Date.now()}`, text });
    this.s.setState("running");
    this.inbox.push(userMsg(withReminder(text)));
  }

  stop() {
    this.inbox.close();
    this.abort.abort();
  }
}

function toolTitle(b) {
  const i = b.input ?? {};
  const short = (p) => String(p ?? "").replaceAll("\\", "/").split("/").slice(-3).join("/");
  switch (b.name) {
    case "Read": return `Read ${short(i.file_path)}`;
    case "Write": return `Write ${short(i.file_path)}`;
    case "Edit": case "MultiEdit": return `Edit ${short(i.file_path)}`;
    case "Bash": return `Run ${String(i.command ?? "").slice(0, 90)}`;
    case "Grep": return `Search "${i.pattern}"`;
    case "Glob": return `Find ${i.pattern}`;
    case "WebSearch": return `Web search "${i.query}"`;
    case "WebFetch": return `Fetch ${i.url}`;
    case "Task": case "Agent": return `Subagent: ${i.description ?? ""}`;
    default: return b.name;
  }
}

function errorKind(err) {
  return /auth|login|credential|401|api key/i.test(String(err?.message ?? err)) ? "login" : "other";
}

function friendlyError(err) {
  const msg = String(err?.message ?? err);
  if (/auth|login|credential|401|api key/i.test(msg)) return `${msg}\nLog in to Claude Code in a terminal (run \`claude\`), or use API-key mode.`;
  return msg;
}
