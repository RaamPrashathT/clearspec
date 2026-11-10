# Connecting spec-it to coding-agent CLIs

Research for `cli-app`, the local (installer) version of spec-it. Goal: run the skill through whatever agent CLI the developer already has and is logged into, so no API key is needed. An API key stays as an option.

## Summary

| Route | Covers | Login | Questions | Status in cli-app |
|---|---|---|---|---|
| **Claude Agent SDK** (`@anthropic-ai/claude-agent-sdk`) | Claude Code | Existing Claude Code login, or `ANTHROPIC_API_KEY` | Native `AskUserQuestion` through `canUseTool`, with option previews | Built (adapter `claude-sdk`) |
| **ACP** (Agent Client Protocol, JSON-RPC over stdio) | ~50 agents: Gemini CLI, Codex, Copilot, OpenCode, Cursor, Qwen, Goose, Kiro, Kimi, Mistral Vibe, Cline, Augment, Factory Droid, Junie, OpenHands… | Each agent's own login, or its API-key env var | `ask_user` tool on an MCP server the app injects into `session/new` | Built (adapter `acp`) |
| Vendor-specific servers | `codex app-server`, `opencode serve` (HTTP + OpenAPI) | Own login | Vendor events | Not needed while ACP covers them |
| Plain `-p` / `exec --json` one-shots | Any CLI | Own login | No multi-turn questions without a session; brittle | Rejected |

**ACP is the "almost all agents" answer.** It is the protocol Zed, JetBrains, Neovim (avante), Obsidian and Microsoft Terminal use to host external agents. One client implementation reaches every agent on the [ACP agent list](https://agentclientprotocol.com/overview/agents). Agents without native ACP get a small adapter (Claude, Codex, Pi).

## Launch commands (ACP mode)

| Agent | Command | API-key env (for key mode) | Notes |
|---|---|---|---|
| Gemini CLI | `gemini --acp` | `GEMINI_API_KEY` | Reference ACP implementation. Older builds: `--experimental-acp`. |
| Codex CLI | `npx -y @zed-industries/codex-acp` | `OPENAI_API_KEY` | Adapter around Codex; uses the Codex login. |
| GitHub Copilot CLI | `copilot --acp --stdio` | — (GitHub login) | Public preview. Reported to auto-approve tools without `request_permission`. |
| OpenCode | `opencode acp` | provider env vars | Also has `opencode serve` (HTTP). |
| Cursor | `cursor-agent acp` | `CURSOR_API_KEY` | Adapter still maturing. |
| Qwen Code | `qwen --acp` | `DASHSCOPE_API_KEY` / OpenAI-compatible | Gemini CLI fork. |
| Goose | `goose acp` | provider env vars | |
| Claude Code via ACP | `npx -y @zed-industries/claude-agent-acp` | `ANTHROPIC_API_KEY` | Alternative to the native SDK route; loses `AskUserQuestion` previews. |
| Anything else on the list | user-defined command | — | "Custom ACP agent" in the app. |

Commands and flags move fast. The registry lives in `src/agents.mjs`, so updating one is a one-line change.

## ACP in one screen

Newline-delimited JSON-RPC 2.0 on the agent's stdin/stdout.

1. `initialize` `{protocolVersion: 1, clientCapabilities: {fs: {readTextFile: false, writeTextFile: false}, terminal: false}}`: the agent answers with its capabilities and `authMethods`. We advertise no fs or terminal so the agent uses its own tools on disk.
2. `session/new` `{cwd, mcpServers: [{name, command, args, env: [{name, value}]}]}` → `{sessionId}`. Stdio MCP servers are mandatory for every agent; HTTP ones are gated by `mcpCapabilities.http`. An `auth_required` error means the developer must log in to that CLI first.
3. `session/prompt` `{sessionId, prompt: [{type: "text", text}]}`: resolves with `{stopReason}` (`end_turn`, `max_tokens`, `refusal`, `cancelled`…) when the turn ends.
4. During the turn the agent sends `session/update` notifications: `agent_message_chunk`, `agent_thought_chunk`, `tool_call`, `tool_call_update`, `plan`, `usage_update`, and more.
5. The agent may call `session/request_permission` `{toolCall, options: [{optionId, name, kind: allow_once|allow_always|reject_once|reject_always}]}`; the client answers `{outcome: {outcome: "selected", optionId}}` or `{outcome: {outcome: "cancelled"}}`.
6. `session/cancel` (notification) stops the turn.

## How questions reach the web UI

spec-it is driven by multiple-choice questions. The two routes handle them differently:

- **Claude SDK:** Claude calls its built-in `AskUserQuestion`. The SDK hands it to `canUseTool`, which stays pending until the developer answers in the browser, then returns `{behavior: "allow", updatedInput: {questions, answers}}`. `toolConfig.askUserQuestion.previewFormat: "markdown"` turns on the ASCII-sketch previews the design question uses. No timeout.
- **ACP agents:** there's no standard "ask the user a structured question" message in ACP v1. The app injects its own stdio MCP server (`src/mcp-bridge.mjs`) with one tool, `ask_user`, with the same schema as `AskUserQuestion`. The tool posts the questions to the app and **returns immediately**, telling the agent to end its turn. The developer's answers arrive as the next `session/prompt`. This avoids MCP tool timeouts (Codex defaults to 60 s per tool call) and fits ACP's turn model.
- **Fallback:** if an agent ignores MCP tools, it can end a message with a fenced `spec-it-questions` JSON block; the app parses it into the same picker.

## Login and policy

- **CLI-login mode** runs on the developer's machine and drives their own installed CLI with their own login. The app never sees or stores a token. This is the supported way to use a subscription.
- **API-key mode** passes the key only as an environment variable to the child process (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`…). It's kept in memory, never written to disk.
- **Hosted version (later):** API keys only. Anthropic's terms don't allow a third-party hosted product to offer claude.ai or subscription login without approval. Check the current [Agent SDK](https://code.claude.com/docs/en/agent-sdk/overview) terms before shipping.

## Sources

- [ACP overview](https://agentclientprotocol.com/protocol/overview), [session setup](https://agentclientprotocol.com/protocol/session-setup), [agents list](https://agentclientprotocol.com/overview/agents)
- [Claude Agent SDK: approvals and user input](https://code.claude.com/docs/en/agent-sdk/user-input)
- [Gemini CLI ACP mode](https://geminicli.com/docs/cli/acp-mode/), [Copilot CLI ACP server](https://docs.github.com/en/copilot/reference/acp-server), [acp-cli agent table](https://docs.rs/crate/acp-cli/0.3.1)
- [Codex app-server guide](https://codex.danielvaughan.com/2026/04/15/codex-app-server-complete-guide/), [OpenCode server](https://opencode.ai/docs/server/)
