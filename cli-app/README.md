# clearspec (helper)

The small program that lets the clearspec web app use the coding agents on your computer. It is not a local copy of the app: there is no UI here. Open the web app in a browser, choose **Add a computer**, and run the command it shows:

```bash
npx -y clearspec@0.1 connect <CODE> --server https://<your-clearspec-worker>
```

Keep that window open. Runs started in the web app then run here, with the agent logins you already have. Nothing is installed globally. Needs Node 20+.

Agents: Claude Code (Claude Agent SDK), Codex, GitHub Copilot CLI, Cursor Agent, Gemini CLI, OpenCode, or any ACP agent. The registry is `src/agents.mjs`.

## How it works

```
web app ⇄ Cloudflare Worker (Durable Objects) ⇄ outbound WebSocket ⇄ clearspec connect ⇄ agent CLI
```

`src/remote.mjs` pairs the computer, holds the WebSocket, and starts runs. `src/server.mjs` is a headless engine on 127.0.0.1 (random port, one-time token). `src/adapters/` drives Claude (SDK) or any ACP agent (JSON-RPC over stdio). `src/mcp-bridge.mjs` gives ACP agents an `ask_user` tool so questions reach the web UI.

## Develop

```bash
npm install
npm test            # engine smoke test against a mock ACP agent
npm run sync-skill  # copy ../skill into this package before packing
npm publish         # prepack syncs the skill and checks the tarball
```
