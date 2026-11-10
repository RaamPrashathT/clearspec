# clearspec

Turn an idea into a `REQUIREMENTS.md` a coding agent can build from, plus clickable mockups. clearspec researches your codebase and how established products solve the problem, then asks only the questions that change what gets built.

> Work in progress: this repo is being rebuilt. The skill works today; the CLI and web app are being rewritten.

## Install the skill (Claude Code)

```bash
claude plugin marketplace add RaamPrashathT/clearspec
claude plugin install clearspec@clearspec
```

Then in a project: `/clearspec:clearspec "an app for roommates to split shared bills"`.

## What you get

```
clearspec/<name>/
├── REQUIREMENTS.md      intent, decisions, phases, requirements (FR), edge cases (EC), assumptions
└── mockups/             UI screens, or api.html + openapi.yaml, or cli.html + transcripts.md
```

## Repository

```
.claude-plugin/marketplace.json   Claude Code marketplace entry
plugins/clearspec/                the plugin; skills/clearspec/ is the skill (single source of truth)
packages/engine/                  runs the skill through the Claude Agent SDK or ACP agents
packages/ui/                      shared React UI for the CLI and web app
apps/cli/                         npm package `clearspec`: local web app
apps/web/                         hosted app on Cloudflare
evals/                            personas, fixtures, persona runner, test projects
examples/                         finished sample specs and mockups
docs/                             research and design notes
```

## Develop

Requires Node 20+ and pnpm.

```bash
pnpm install
pnpm test               # runs the check script on every eval fixture
```

See [evals/README.md](evals/README.md) for persona runs and [CONTRIBUTING.md](CONTRIBUTING.md) for conventions.

## License

MIT
