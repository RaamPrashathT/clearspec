// GitHub Copilot through the official Copilot SDK (@github/copilot-sdk). It runs the Copilot runtime itself,
// signs in with the user's existing Copilot / GitHub CLI login, lists the real models and plan tiers, and takes
// our `ask_user` tool natively, so no MCP bridge or ACP is needed.
// If the SDK isn't installed, start() throws an error with `sdkUnavailable: true` and server.mjs falls back to ACP.
import path from "node:path";
import { z } from "zod";
import { buildKickoff, formatAnswers } from "../prompt.mjs";

const inside = (p, base) => {
  const rel = path.relative(path.resolve(base), path.resolve(String(p)));
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
};
const fwd = (p) => String(p).replaceAll("\\", "/");

const option = z.object({
  label: z.string().describe("1–5 words. Put \"(Recommended)\" at the end of the recommended option."),
  description: z.string().describe("What happens if chosen."),
  preview: z.string().optional().describe("Optional ASCII sketch or code shown next to the option."),
});
const question = z.object({
  question: z.string().describe("One full sentence that makes sense on its own."),
  header: z.string().max(12).describe("Topic chip, at most 12 characters."),
  multiSelect: z.boolean().default(false),
  options: z.array(option).min(2).max(4),
});

export async function loadCopilotSdk() {
  try { return await import("@github/copilot-sdk"); }
  catch (err) { throw Object.assign(new Error(`The Copilot SDK isn't installed (${err.code ?? err.message}).`), { sdkUnavailable: true }); }
}

/** Model picker entries from the runtime's catalog: individual models plus the auto tiers this plan can use. */
export function modelOptions(list) {
  const out = [{ value: "", name: "Auto", description: "Copilot chooses the model" }];
  for (const m of list?.models ?? []) out.push({ value: m.id, name: m.name ?? m.id, description: m.policy?.state === "disabled" ? "Not enabled for your account" : "" });
  const tiers = (list?.auto?.tiers ?? []).filter((t) => t.status?.enabled && t.status?.pickerVisible && t.id !== list?.auto?.defaultTier);
  for (const t of tiers) out.push({ value: `auto:${t.id}`, name: `Auto · ${t.displayName}`, description: t.description ?? "" });
  return out;
}

export class CopilotSdkAdapter {
  constructor(session, { skillDir }) {
    this.s = session;
    this.skillDir = skillDir;
    this.askedThisTurn = false;
  }

  async start() {
    const s = this.s;
    const sdk = await loadCopilotSdk();
    this.client = new sdk.CopilotClient({ logLevel: "error" });
    await this.client.start();

    const auth = await this.client.getAuthStatus().catch(() => null);
    if (auth && auth.isAuthenticated === false) {
      this.fail(`You're not signed in to GitHub Copilot.\n${s.agent.loginHint}`, "login");
      return;
    }
    s.emitEvent({ type: "text", role: "system", id: "launch", text: `Started clearspec with GitHub Copilot${auth?.login ? ` (signed in as ${auth.login}${auth.authType ? ` via ${auth.authType}` : ""})` : ""}.` });

    this.client.rpc.models.list().then((list) => {
      this.catalog = modelOptions(list);
      this.emitModels(s.model);
    }).catch(() => {});

    const askUser = sdk.defineTool("ask_user", {
      description: "Show 1–3 multiple-choice questions to the developer in the clearspec app. An \"Other\" free-text field is added automatically. After calling this, END YOUR TURN immediately; the answers arrive as the next user message.",
      parameters: z.object({ questions: z.array(question).min(1).max(4) }),
      handler: async ({ questions }) => {
        this.askedThisTurn = true;
        this.askFromAgent(questions);
        return "The questions are now on the developer's screen. End your turn now and write nothing else; their answers will arrive as the next user message.";
      },
    });

    const plainModel = s.model && !s.model.startsWith("auto:") ? s.model : undefined;
    this.copilot = await this.client.createSession({
      workingDirectory: s.projectDir,
      streaming: true,
      ...(plainModel ? { model: plainModel } : {}),
      ...(s.effort ? { reasoningEffort: s.effort } : {}),
      tools: [askUser],
      onPermissionRequest: (req) => this.permission(req),
    });
    if (s.model?.startsWith("auto:")) await this.copilot.setModel("auto", { autoTier: s.model.slice(5) }).catch((e) => this.notice("Couldn't select that tier", e.message));

    this.wire(this.copilot);
    s.watchOutputs();
    s.setState("running");
    await this.copilot.send({ prompt: buildKickoff({ skillDir: this.skillDir, projectDir: s.projectDir, idea: s.idea, channel: "tool" }) });
  }

  wire(c) {
    const s = this.s;
    c.on("assistant.message_delta", (e) => { if (!e.data.parentToolCallId) s.emitEvent({ type: "text-delta", id: e.data.messageId, text: e.data.deltaContent }); });
    c.on("assistant.reasoning_delta", (e) => s.emitEvent({ type: "thought-delta", id: e.data.reasoningId, text: e.data.deltaContent }));
    c.on("tool.execution_start", (e) => {
      if (e.data.toolName === "ask_user") return;
      s.emitEvent({ type: "tool", id: e.data.toolCallId, title: toolTitle(e.data), status: "in_progress" });
    });
    c.on("tool.execution_complete", (e) => s.emitEvent({ type: "tool-update", id: e.data.toolCallId, status: e.data.success === false ? "failed" : "completed" }));
    c.on("assistant.usage", (e) => s.updateUsage({ inputTokens: e.data.inputTokens ?? 0, outputTokens: e.data.outputTokens ?? 0 }));
    c.on("session.model_change", (e) => {
      const m = e.data.newModel === "auto" && e.data.autoTier ? `auto:${e.data.autoTier}` : e.data.newModel;
      if (m) this.emitModels(m === "auto" ? "" : m);
    });
    c.on("session.error", (e) => {
      const msg = e.data.message ?? "Copilot reported an error.";
      const login = /auth|sign.?in|login|credential|401|token/i.test(`${e.data.errorType} ${msg}`);
      s.emitEvent({ type: "error", kind: login ? "login" : "other", message: login ? `${msg}\n${s.agent.loginHint}` : msg });
      s.setState("error", msg);
    });
    c.on("session.idle", () => {
      this.askedThisTurn = false;
      if (s.pending.size === 0 && !["error", "stopped", "done"].includes(s.state)) s.setState("idle", "Your turn");
      s.refreshOutputs();
    });
  }

  /** Reads and writes stay inside the project and the skill; only the skill's own scripts run without asking. */
  async permission(req) {
    const s = this.s;
    const ok = { kind: "approve-once" };
    if (req.kind === "read" && (inside(req.path ?? "", s.projectDir) || inside(req.path ?? "", this.skillDir))) return ok;
    if (req.kind === "write" && inside(req.fileName ?? req.path ?? "", path.join(s.projectDir, "clearspec"))) return ok;
    if (req.kind === "url") return ok; // research: web search and fetch
    if (req.kind === "custom-tool") return ok; // our ask_user
    if (req.kind === "shell") {
      const cmd = fwd(req.fullCommandText ?? "");
      if (/^\s*node\s+/.test(cmd) && cmd.includes(fwd(this.skillDir) + "/scripts/")) return ok;
    }
    const choice = await s.approve({
      title: req.intention || `Copilot wants to ${req.kind}`,
      detail: (req.fullCommandText ?? req.fileName ?? req.path ?? req.url ?? JSON.stringify(req, null, 2)).toString().slice(0, 1500),
      options: [{ id: "allow", name: "Allow", kind: "allow_once" }, { id: "deny", name: "Deny", kind: "reject_once" }],
    });
    return choice === "allow" ? ok : { kind: "reject", feedback: "The developer denied this action." };
  }

  async askFromAgent(questions) {
    const answers = await this.s.ask(questions);
    if (!answers) return;
    this.sendRaw(formatAnswers(questions, answers));
  }

  notice(title, description) {
    this.s.emitEvent({ type: "notice", severity: "warning", title, description });
  }

  emitModels(current) {
    if (!this.catalog) return;
    this.s.emitEvent({ type: "models", current: current || "", options: this.catalog });
  }

  async setModel(value) {
    if (value.startsWith("auto:")) await this.copilot.setModel("auto", { autoTier: value.slice(5) });
    else if (!value) await this.copilot.setModel("auto");
    else await this.copilot.setModel(value);
    this.s.model = value;
    this.emitModels(value);
    this.s.emitEvent({ type: "text", role: "system", id: "m" + Date.now(), text: "Model set to " + (value || "Auto") + "." });
  }

  sendRaw(text) {
    this.s.setState("running");
    return this.copilot.send({ prompt: text }).catch((err) => this.fail(err.message));
  }

  sendUser(text) {
    this.s.emitEvent({ type: "text", role: "user", id: `u${Date.now()}`, text });
    return this.sendRaw(text);
  }

  fail(message, kind = "other") {
    if (this.s.state === "error") return;
    this.s.emitEvent({ type: "error", kind, message });
    this.s.setState("error", message);
  }

  stop() {
    Promise.resolve(this.copilot?.abort?.()).catch(() => {});
    setTimeout(() => { Promise.resolve(this.client?.stop?.()).catch(() => this.client?.forceStop?.()); }, 800);
  }
}

function toolTitle(d) {
  const a = d.arguments ?? {};
  const short = (p) => fwd(p ?? "").split("/").slice(-3).join("/");
  switch (d.toolName) {
    case "view": return `Read ${short(a.path)}`;
    case "create": case "edit": case "write": return `${d.toolName === "edit" ? "Edit" : "Write"} ${short(a.path)}`;
    case "powershell": case "bash": case "shell": return `Run ${String(a.command ?? "").slice(0, 90)}`;
    case "grep": return `Search "${a.pattern ?? ""}"`;
    case "glob": return `Find ${a.pattern ?? ""}`;
    case "web_search": return `Web search "${a.query ?? ""}"`;
    case "web_fetch": return `Fetch ${a.url ?? ""}`;
    default: return d.toolName;
  }
}
