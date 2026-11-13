# clearspec

Turn an idea into a `REQUIREMENTS.md` a coding agent can build from, plus clickable mockups. clearspec researches your codebase and how established products solve the problem, then asks only the questions that change what gets built.

It is a **skill first** and a web app second.

```
skills/clearspec/  the clearspec skill: SKILL.md, references, templates, check/render scripts
cli-app/    the `clearspec` npm package: the helper behind `npx clearspec connect`
web-app/    the hosted app: React UI + Cloudflare Worker with Durable Objects
```

## 1. The skill (Claude Code)

Install it into a project with `npx skills add RaamPrashathT/clearspec`, or copy `skills/clearspec/` into `.claude/skills/clearspec/` by hand, then run `/clearspec "an app for roommates to split shared bills"`. Output goes to `clearspec/<name>/`:

```
clearspec/<name>/
├── REQUIREMENTS.md      intent, decisions, phases, requirements (FR), edge cases (EC), assumptions
└── mockups/             UI screens, or api.html + openapi.yaml, or cli.html + transcripts.md
```

## 2. The web app

Sign in with GitHub, pair your computer, pick an agent (Claude Code, Codex, GitHub Copilot CLI or Cursor Agent), describe the idea, answer the questions in the browser, and watch `REQUIREMENTS.md` and the mockups appear.

```
browser ⇄ Worker + Durable Objects ⇄ outbound WebSocket ⇄ `clearspec connect` (your computer) ⇄ agent CLI
```

Agents run on **your** computer with **your** logins. No API key, nothing installed globally: the web app shows one command (`npx -y clearspec@0.1 connect <code> --server <url>`) and you run it once.

- Setup, deploy and GitHub OAuth steps: [web-app/README.md](web-app/README.md)
- The helper: [cli-app/README.md](cli-app/README.md)

## Develop

```bash
cd cli-app && npm install && npm test          # engine against a mock ACP agent
cd web-app && npm install && npm --prefix ui install
cp .dev.vars.example .dev.vars && npm run dev   # http://127.0.0.1:8787, sign in at /auth/dev-login
node test/e2e.mjs http://127.0.0.1:8787         # with the dev server running
```

## License

MIT
