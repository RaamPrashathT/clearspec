// Registry of the agent CLIs clearspec can drive. One entry per agent; launch commands change often.
// The user's own CLI login is always used. API-key mode is not part of this build.
import { spawnSync } from "node:child_process";

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
  { id: "copilot", name: "GitHub Copilot CLI", kind: "acp", detect: ["copilot"], command: "copilot", args: ["--acp", "--stdio"],
    loginHint: "Run `copilot` in a terminal and use /login." },
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

/** The first of the agent's binaries that is on PATH and actually runs, or null. */
export function installedBinary(agent) {
  for (const bin of agent.detect ?? []) if (which(bin) && runs(bin)) return bin;
  return null;
}

/** The command and args to launch an ACP agent (null for non-ACP agents). */
export function launchCommand(agent) {
  if (agent.kind !== "acp" || agent.id === "custom") return null;
  const command = agent.command ?? installedBinary(agent) ?? agent.detect[0];
  return { command, args: agent.args };
}

export function listAgents() {
  return AGENTS.map((a) => {
    const launch = launchCommand(a);
    return {
      id: a.id, name: a.name, kind: a.kind, loginHint: a.loginHint,
      command: launch ? [launch.command, ...launch.args].join(" ") : null,
      installed: a.id === "custom" ? true : Boolean(installedBinary(a)),
    };
  });
}

export function getAgent(id) {
  return AGENTS.find((a) => a.id === id) ?? null;
}

/** Split "cmd arg1 'arg two'" into [cmd, ...args]. */
export function splitCommand(line) {
  const parts = line.match(/"[^"]*"|'[^']*'|\S+/g) ?? [];
  return parts.map((p) => p.replace(/^["']|["']$/g, ""));
}
