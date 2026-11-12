// Registry of the agent CLIs clearspec can drive. One entry per agent; launch commands change often.
// The user's own CLI login is always used. API-key mode is not part of this build.
import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";

export const isWin = process.platform === "win32";

/**
 * kind: "claude-sdk" uses the Claude Agent SDK; "acp" speaks the Agent Client Protocol over stdio.
 * detect: binaries to look for on PATH; the first one found counts as installed (and is the one launched
 *         when `command` is null).
 * Adapter packages are pinned: an unpinned `npx -y` would run whatever was published last.
 */
export const AGENTS = [
  { id: "claude", name: "Claude Code", kind: "claude-sdk", detect: ["claude"], loginHint: "Run `claude` once in a terminal and log in." },
  { id: "codex", name: "Codex CLI", kind: "acp", detect: ["codex"], command: "npx", args: ["-y", "@zed-industries/codex-acp@0.16.0"],
    loginHint: "Run `codex login` in a terminal." },
  // Runs through the Copilot SDK (bundled runtime). `command` + `args` are the ACP fallback if the SDK can't be loaded.
  { id: "copilot", name: "GitHub Copilot CLI", kind: "copilot-sdk", detect: ["copilot"], command: "copilot", args: ["--acp", "--stdio"],
    loginHint: "Run `gh auth login` (or `copilot login`) in a terminal." },
  // Cursor installs the same binary as `agent` and `cursor-agent`. Prefer the specific name.
  { id: "cursor", name: "Cursor Agent", kind: "acp", detect: ["cursor-agent", "agent"], command: null, args: ["acp"],
    loginHint: "Run `cursor-agent login` (or `agent login`) in a terminal." },
  { id: "gemini", name: "Gemini CLI", kind: "acp", detect: ["gemini"], command: "gemini", args: ["--acp"],
    loginHint: "Run `gemini` once in a terminal and sign in." },
  { id: "opencode", name: "OpenCode", kind: "acp", detect: ["opencode"], command: "opencode", args: ["acp"],
    loginHint: "Run `opencode auth login`." },
  { id: "custom", name: "Custom ACP agent", kind: "acp", detect: [], command: null, args: [],
    loginHint: "Any agent from agentclientprotocol.com/overview/agents. Enter its ACP launch command." },
];

const cache = new Map();

export function which(bin) {
  if (!bin) return null;
  if (cache.has(bin)) return cache.get(bin);
  const r = spawnSync(isWin ? "where" : "which", [bin], { encoding: "utf8" });
  const path = r.status === 0 ? r.stdout.split(/\r?\n/).find(Boolean)?.trim() ?? null : null;
  cache.set(bin, path);
  return path;
}

const works = new Map();

/**
 * A launcher can exist on PATH without the tool behind it (the VS Code `copilot` shim only offers to install
 * the real CLI). Ask it for its version: a non-zero exit means "not really installed". A timeout counts as installed.
 */
function runs(bin) {
  if (works.has(bin)) return works.get(bin);
  const r = spawnSync(bin, ["--version"], { encoding: "utf8", timeout: 8000, shell: isWin, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  const ok = r.error?.code === "ETIMEDOUT" || (r.status === 0 && !/not found|not installed/i.test(`${r.stdout}${r.stderr}`));
  works.set(bin, ok);
  return ok;
}

/** True when the Copilot SDK (and with it the bundled Copilot runtime) is installed next to this package. */
export function copilotSdkAvailable() {
  try { createRequire(import.meta.url).resolve("@github/copilot-sdk"); return true; } catch { return false; }
}

/** The first of the agent's binaries that is on PATH and actually runs, or null. */
export function installedBinary(agent) {
  for (const bin of agent.detect ?? []) if (which(bin) && runs(bin)) return bin;
  return null;
}

/** The command and args to launch an ACP agent (null for the Claude SDK; the Copilot entry is its ACP fallback). */
export function launchCommand(agent) {
  if (agent.kind === "claude-sdk" || agent.id === "custom") return null;
  const command = agent.command ?? installedBinary(agent) ?? agent.detect[0];
  return { command, args: agent.args };
}

export function listAgents() {
  return AGENTS.map((a) => {
    const launch = launchCommand(a);
    return {
      id: a.id, name: a.name, kind: a.kind, loginHint: a.loginHint,
      command: launch ? [launch.command, ...launch.args].join(" ") : null,
      installed: a.id === "custom" ? true : a.kind === "copilot-sdk" ? copilotSdkAvailable() || Boolean(installedBinary(a)) : Boolean(installedBinary(a)),
    };
  });
}

// ---------------------------------------------------------------------------------------------
// Sign-in status. Each CLI that has a quiet status command is asked; the result is "ok", "needed" or "unknown".
// Copilot has no status command and starts its ACP server fine while signed out, so it stays "unknown".
const LOGIN_CHECK = {
  claude: { args: ["auth", "status"], ok: /"loggedIn"\s*:\s*true/, bad: /"loggedIn"\s*:\s*false/ },
  codex: { args: ["login", "status"], ok: /logged in/i, bad: /not logged in/i },
  cursor: { args: ["status"], ok: /logged in/i, bad: /not logged in|not authenticated|login required/i },
};

function runStatus(bin, args, timeoutMs = 12_000) {
  return new Promise((resolve) => {
    let out = "", settled = false;
    const done = (v) => { if (!settled) { settled = true; clearTimeout(timer); resolve(v); } };
    let proc;
    try { proc = spawn(bin, args, { shell: isWin, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }); }
    catch { return resolve(null); }
    const timer = setTimeout(() => { try { proc.kill(); } catch { /* gone */ } done(null); }, timeoutMs);
    proc.stdout.on("data", (d) => { out += d; });
    proc.stderr.on("data", (d) => { out += d; });
    proc.on("error", () => done(null));
    proc.on("close", (code) => done({ code, out }));
  });
}

/** Copilot: ask the SDK's runtime who is signed in (env token, Copilot login, or the GitHub CLI). */
async function copilotLogin() {
  try {
    const sdk = await import("@github/copilot-sdk");
    const client = new sdk.CopilotClient({ logLevel: "none" });
    await client.start();
    try { return (await client.getAuthStatus()).isAuthenticated ? "ok" : "needed"; }
    finally { client.stop().catch(() => client.forceStop?.()); }
  } catch {
    // No SDK: a GitHub token in the environment or a signed-in GitHub CLI is what the Copilot CLI uses too.
    if (process.env.COPILOT_GITHUB_TOKEN || process.env.GH_TOKEN || process.env.GITHUB_TOKEN) return "ok";
    const r = await runStatus("gh", ["auth", "token"], 8000);
    return r && r.code === 0 && r.out.trim() ? "ok" : "unknown";
  }
}

export async function loginStatus(agent) {
  if (agent.id === "copilot") return copilotLogin();
  const check = LOGIN_CHECK[agent.id];
  const bin = installedBinary(agent);
  if (!check || !bin) return "unknown";
  const r = await runStatus(bin, check.args);
  if (!r) return "unknown";
  if (check.ok.test(r.out) && !check.bad.test(r.out)) return "ok";
  if (check.bad.test(r.out) || (r.code !== 0 && r.out.trim())) return "needed";
  return "unknown";
}

const loginCache = new Map(); // agent id -> { at, value }

/** listAgents() plus a `login` field for installed agents. `fresh` skips the 20 s cache (the "Check again" button). */
export async function describeAgents({ fresh = false } = {}) {
  const agents = listAgents();
  await Promise.all(agents.map(async (a) => {
    if (!a.installed || a.id === "custom") return;
    const hit = !fresh && loginCache.get(a.id);
    if (hit && Date.now() - hit.at < 20_000) { a.login = hit.value; return; }
    a.login = await loginStatus(getAgent(a.id));
    loginCache.set(a.id, { at: Date.now(), value: a.login });
  }));
  return agents;
}

export function getAgent(id) {
  return AGENTS.find((a) => a.id === id) ?? null;
}

/** Split "cmd arg1 'arg two'" into [cmd, ...args]. */
export function splitCommand(line) {
  const parts = line.match(/"[^"]*"|'[^']*'|\S+/g) ?? [];
  return parts.map((p) => p.replace(/^["']|["']$/g, ""));
}
