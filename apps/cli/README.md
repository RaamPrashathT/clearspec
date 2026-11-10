# clearspec (CLI)

The npm package `clearspec`. Run `clearspec` inside a project to open a local web app that runs the skill with the coding agent you already use (Claude Code, Codex, Gemini CLI, Copilot, OpenCode, any ACP agent), or an API key.

Built from `@clearspec/engine` and `@clearspec/ui`. The skill ships inside the package, copied from `plugins/clearspec/skills/clearspec` at build time.

## Planned

- `clearspec` starts the local app on 127.0.0.1 with a one-time token.
- `clearspec connect` pairs the computer with the hosted web app.
- Tests and CI before the first publish.
