// Mirrors cli-app/src/agents.mjs. The paired computer reports which agents are really installed;
// this list is the fallback shown before a computer answers.
export const AGENTS = [
  { id: "claude", name: "Claude Code", kind: "claude-sdk", loginHint: "Run `claude` once in a terminal and log in." },
  { id: "codex", name: "Codex CLI", kind: "acp", loginHint: "Run `codex login` in a terminal." },
  { id: "copilot", name: "GitHub Copilot CLI", kind: "acp", loginHint: "Run `copilot` in a terminal and use /login." },
  { id: "cursor", name: "Cursor Agent", kind: "acp", loginHint: "Run `cursor-agent login` (or `agent login`) in a terminal." },
  { id: "gemini", name: "Gemini CLI", kind: "acp", loginHint: "Run `gemini` once in a terminal and sign in." },
  { id: "opencode", name: "OpenCode", kind: "acp", loginHint: "Run `opencode auth login`." },
  { id: "custom", name: "Custom ACP agent", kind: "acp", loginHint: "Any agent from agentclientprotocol.com/overview/agents. Enter its ACP launch command." },
].map((a) => ({ ...a, command: null, installed: false }))

export const CLAUDE_MODELS = [
  { value: "opus", name: "Opus (latest)", description: "Best questions and specs" },
  { value: "sonnet", name: "Sonnet (latest)", description: "Faster and cheaper" },
  { value: "haiku", name: "Haiku (latest)", description: "Fastest" },
]
