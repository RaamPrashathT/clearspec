# @clearspec/engine

Runs the clearspec skill for the CLI and the web app. Not published on its own.

## Scope

- Adapters: Claude Agent SDK, and Agent Client Protocol (ACP) agents over stdio.
- Sessions: event log, pending questions and approvals, output discovery.
- Saved runs on disk, so a run survives a restart and can be resumed or listed.
- The `ask_user` MCP bridge for ACP agents.

## Carry-over from the old `cli-app/src` (rebuild, don't copy)

- Limit file writes to the project folder. The old adapter auto-approved `Write`/`Edit` anywhere.
- Pin ACP adapter versions (no unpinned `npx -y`). Read launch commands from the ACP registry.
- Add tests, including a mock ACP agent.
