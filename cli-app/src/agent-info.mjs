// Live info about an agent before a run starts: its real model list, the account, and plan usage.
// Claude: the Agent SDK answers supportedModels / accountInfo / usage without sending a prompt (no tokens).
// ACP agents: connect, open a session, read its configOptions (model, effort…), disconnect.
import { spawn } from "node:child_process";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { isWin } from "./agents.mjs";
import { loadCopilotSdk, modelOptions } from "./adapters/copilot-sdk.mjs";

const cache = new Map(); // key -> { at, value }
const TTL = 60_000;

/** A prompt stream that never yields: the SDK starts and answers control requests, but no turn runs. */
const silent = () => ({ [Symbol.asyncIterator]: () => ({ next: () => new Promise(() => {}) }) });

export async function claudeInfo({ authMode, apiKey, cwd }) {
  const key = `claude:${authMode}`;
  const hit = authMode === "cli" && cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.value;

  const env = { ...process.env };
  if (authMode === "apiKey") env.ANTHROPIC_API_KEY = apiKey; else delete env.ANTHROPIC_API_KEY;
  const abort = new AbortController();
  const q = query({ prompt: silent(), options: { cwd, env, abortController: abort } });
  const timer = setTimeout(() => abort.abort(), 30_000);
  try {
    const [models, account] = await Promise.all([q.supportedModels(), q.accountInfo().catch(() => null)]);
    let usage = null;
    try { usage = await q.usage_EXPERIMENTAL_MAY_CHANGE_DO_NOT_RELY_ON_THIS_API_YET({ skipBehaviors: true }); } catch {}
    const value = {
      source: "claude-sdk",
      models: models.map((m) => ({ value: m.value, name: m.displayName, description: m.description, efforts: m.supportedEffortLevels ?? null })),
      account: account ? { plan: account.subscriptionType ?? (account.apiKeySource ? "API key" : null), organization: account.organization ?? null, provider: account.apiProvider ?? null } : null,
      limits: normalizeLimits(usage),
    };
    if (authMode === "cli") cache.set(key, { at: Date.now(), value });
    return value;
  } finally {
    clearTimeout(timer);
    abort.abort();
  }
}

/** Plan windows as [{ label, percent, resetsAt }]. Empty for API keys (no plan limits). */
export function normalizeLimits(usage) {
  if (!usage?.rate_limits_available && !usage?.rate_limits) return [];
  const r = usage.rate_limits ?? {};
  if (Array.isArray(r.limits) && r.limits.length) {
    return r.limits
      .filter((l) => typeof l.percent === "number" && (l.kind !== "weekly_scoped" || l.percent > 0))
      .map((l) => ({
        label: l.kind === "session" ? "5-hour" : l.kind === "weekly_all" ? "Weekly" : `Weekly · ${l.scope?.model?.display_name ?? "scoped"}`,
        percent: l.percent,
        resetsAt: l.resets_at ?? null,
      }));
  }
  return [["five_hour", "5-hour"], ["seven_day", "Weekly"], ["seven_day_opus", "Weekly · Opus"], ["seven_day_sonnet", "Weekly · Sonnet"]]
    .filter(([k]) => typeof r[k]?.utilization === "number")
    .map(([k, label]) => ({ label, percent: r[k].utilization, resetsAt: r[k].resets_at ?? null }));
}

/** Flatten an ACP select option (grouped or not) into [{ value, name, description }]. */
export function flattenSelect(opt) {
  return (opt?.options ?? []).flatMap((x) => (Array.isArray(x.options) ? x.options : [x]))
    .map((o) => ({ value: o.value, name: o.name, description: o.description ?? "" }));
}

/** Connect to an ACP agent just long enough to read its session config options. */
export function acpInfo({ command, args, cwd, env }) {
  const key = `acp:${command} ${args.join(" ")}:${cwd}`;
  const hit = !env.__API_KEY_MODE && cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return Promise.resolve(hit.value);

  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, { cwd, env, shell: isWin, stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
    let buf = "", id = 0, stderr = "";
    const calls = new Map();
    const done = (fn, v) => { clearTimeout(timer); try { proc.kill(); } catch {} fn(v); };
    const timer = setTimeout(() => done(reject, new Error("The agent took too long to start (first runs may be downloading it; try again).")), 150_000);
    const req = (method, params) => new Promise((res, rej) => {
      calls.set(++id, { res, rej });
      proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    });
    proc.on("error", (e) => done(reject, e));
    proc.on("exit", (code) => done(reject, new Error(`The agent exited (code ${code}). ${stderr.slice(-300)}`)));
    proc.stderr.on("data", (d) => { stderr += d; });
    proc.stdout.on("data", (chunk) => {
      buf += chunk;
      let nl;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
        let m; try { m = JSON.parse(line); } catch { continue; }
        if (m.id !== undefined && !m.method && calls.has(m.id)) {
          const c = calls.get(m.id); calls.delete(m.id);
          m.error ? c.rej(Object.assign(new Error(m.error.message), { code: m.error.code })) : c.res(m.result);
        } else if (m.id !== undefined && m.method) {
          proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: m.id, error: { code: -32601, message: "probe" } }) + "\n");
        }
      }
    });
    (async () => {
      const init = await req("initialize", { protocolVersion: 1, clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false }, clientInfo: { name: "clearspec", version: "0.1.0" } });
      const sess = await req("session/new", { cwd, mcpServers: [] });
      const opts = sess.configOptions ?? [];
      const model = opts.find((o) => o.category === "model" && o.type === "select");
      const effort = opts.find((o) => o.category === "thought_level" && o.type === "select");
      // Older agents expose models through the unstable `models` field instead.
      const legacy = sess.models?.availableModels?.map((m) => ({ value: m.modelId, name: m.name, description: m.description ?? "" }));
      const value = {
        source: "acp",
        agent: init.agentInfo ?? null,
        models: model ? flattenSelect(model) : legacy ?? [],
        currentModel: model?.currentValue ?? sess.models?.currentModelId ?? null,
        efforts: effort ? flattenSelect(effort).map((o) => o.value) : null,
        account: null,
        limits: [],
      };
      if (!env.__API_KEY_MODE) cache.set(key, { at: Date.now(), value });
      done(resolve, value);
    })().catch((e) => done(reject, e));
  });
}

/** GitHub Copilot through its SDK: who is signed in, and the models / plan tiers this account can pick. */
export async function copilotInfo() {
  const sdk = await loadCopilotSdk();
  const client = new sdk.CopilotClient({ logLevel: "none" });
  await client.start();
  try {
    const [auth, list] = await Promise.all([client.getAuthStatus().catch(() => null), client.rpc.models.list()]);
    const models = modelOptions(list);
    const tiers = (list?.auto?.tiers ?? []).filter((t) => t.status?.pickerVisible && t.id !== list?.auto?.defaultTier);
    const locked = tiers.filter((t) => !t.status?.enabled).map((t) => t.displayName);
    const def = (list?.auto?.tiers ?? []).find((t) => t.id === list?.auto?.defaultTier)?.displayName;
    return {
      source: "copilot-sdk",
      models: models.length > 1 ? models : [],
      currentModel: "",
      efforts: null,
      account: auth ? { plan: auth.login ? `${auth.login} (${auth.authType ?? "signed in"})` : null, organization: null, provider: "copilot" } : null,
      agent: { name: "GitHub Copilot" },
      limits: [],
      note: models.length > 1
        ? undefined
        : `Copilot chooses the model for you (Auto${def ? `, ${def}` : ""}).${locked.length ? ` ${locked.join(" and ")} ${locked.length > 1 ? "aren't" : "isn't"} on your Copilot plan.` : ""}`,
    };
  } finally {
    client.stop().catch(() => client.forceStop?.());
  }
}
