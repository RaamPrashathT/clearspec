# clearspec web app

The hosted app: a React UI served by one Cloudflare Worker, with Durable Objects holding the state. It does not run any agent itself. Your computer does, through `npx clearspec connect`.

```
Browser (React) ⇄ Worker ── UserHub DO   one per GitHub user: paired computers, runs list, requests to computers
                        ├─ Run DO        one per run: event log, spec + mockup files, browser and runner sockets
                        └─ Pairing DO    one-time pairing codes
                              ▲
                  outbound WebSocket from `clearspec connect` (no open ports on your computer)
                              ▼
                     agent CLI: Claude Code · Codex · GitHub Copilot CLI · Cursor Agent (+ Gemini, OpenCode, any ACP agent)
```

Free plan is enough (SQLite-backed Durable Objects). API-key / cloud-sandbox mode is not part of this app.

## Deploy (you, one time)

Run these in `web-app/`. The Worker is called `clearspec` (`wrangler.jsonc` → `name`), separate from any existing Worker.

### 1. Install and deploy once, to get the URL

```bash
npm install && npm --prefix ui install
npx wrangler login
npm run deploy                     # builds ui/dist, deploys, prints https://clearspec.<your-subdomain>.workers.dev
```

### 2. GitHub OAuth app

GitHub → Settings → Developer settings → OAuth Apps → **New OAuth App**:

- Homepage URL: `https://clearspec.<your-subdomain>.workers.dev`
- Authorization callback URL: `https://clearspec.<your-subdomain>.workers.dev/auth/callback`

Then put the **Client ID** in `wrangler.jsonc` → `vars.GITHUB_CLIENT_ID` and set the secrets:

```bash
npx wrangler secret put GITHUB_CLIENT_SECRET     # the OAuth app's client secret
npx wrangler secret put SESSION_SECRET           # any long random string
npm run deploy
```

A random value: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`

### 3. Publish the helper

The pairing command the UI shows is `npx -y clearspec@0.1 connect <code> --server <url>`, so the helper must be on npm once:

```bash
cd ../cli-app && npm publish       # prepack copies ../skill in and checks the tarball
```

(If you link this repo to Cloudflare for automatic deploys, use build command `npm install && npm --prefix ui install && npm run build` and deploy command `npx wrangler deploy`, root directory `web-app`.)

## Develop locally

```bash
npm install && npm --prefix ui install
cp .dev.vars.example .dev.vars     # DEV_LOGIN=1 lets you sign in at /auth/dev-login (localhost only)
npm run dev                        # builds ui/dist, then wrangler dev on http://127.0.0.1:8787
```

Open `/auth/dev-login`, choose **Add a computer**, and run the command it shows with the local helper:
`node ../cli-app/bin/clearspec.mjs connect <CODE> --server http://127.0.0.1:8787`.

`npm run e2e` (dev server running) signs in, pairs the real helper, runs a mock ACP agent through the whole path, and checks the spec files come back. It needs no GitHub app and no tokens.

| Path | |
|---|---|
| `worker/src/index.ts` | routes: auth, API, WebSocket and file relays, run creation |
| `worker/src/auth.ts` | GitHub OAuth, HMAC-signed session cookie |
| `worker/src/run.ts` | Run Durable Object |
| `worker/src/user-hub.ts` | UserHub and Pairing Durable Objects |
| `worker/src/catalog.ts` | agent list (mirrors `cli-app/src/agents.mjs`) |
| `ui/` | React + shadcn UI |
| `test/e2e.mjs` | end-to-end test |

## Security notes

- Session cookies are HMAC-signed, `HttpOnly`, `Secure`, `SameSite=Lax`. The GitHub token is used once to read the profile and then dropped.
- Computers authenticate with a random token, stored only as a SHA-256 hash. Removing a computer revokes it immediately.
- Each run has its own random runner token. Only the owner's session can read a run, its WebSocket or its files.
- Mockup files are served with a CSP that blocks network access (`connect-src 'none'`).
- Agent logins never leave the user's computer.
