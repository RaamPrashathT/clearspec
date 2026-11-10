# clearspec test projects

Each folder is its own git repo with a clean scaffold committed, and the clearspec skill installed at `.claude/skills/clearspec/` (git-ignored, so resets keep it).

| Project | Contents | Tests | Example rough idea |
|---|---|---|---|
| `01-react-tailwind` | Vite, React 19, TypeScript, Tailwind 4 (default palette, no custom tokens) | stack detection, UI, design from scratch | "a habit tracker for my team" |
| `02-empty` | nothing but `.gitignore` | greenfield, no repo facts to find | any idea |
| `03-express-api` | Express 5, Zod, TypeScript, one `/health` route | API artifacts, OpenAPI agreement | "an API for booking meeting rooms" |
| `04-node-cli` | Node ESM CLI with Commander, `bin: tool` | CLI transcripts, exit codes | "a CLI to clean up old git branches" |
| `05-react-design-system` | "Plotline" agency app: React + Tailwind with custom `@theme` tokens, Button, Input, StatusBadge, AppShell, a Projects table | reusing existing tokens and shell | "let clients approve deliverables" |
| `06-mixed` | React + Tailwind `web/` and Express `server/` as npm workspaces, `/api` proxied | mixed artifacts, shared fixtures | "meeting room booking with a partner API" |

Automated persona runs: `node ../run-persona.mjs <case id> --arm both` (see `evals/README.md`). Results go to `_runs/`.

Keep idea notes here, not inside the projects: the skill scans the project folder, and a note inside it would leak into the run.

## Run a test

1. Open a new Claude Code session with the project folder as its working directory (for example `test-projects/01-react-tailwind`). Start it there so the skill scans that project only and writes `clearspec/` inside it.
2. Type `/clearspec "your rough idea"` and answer as yourself.
3. When it finishes, check the result from that folder:
   ```bash
   node .claude/skills/clearspec/scripts/check.mjs clearspec/<unit>
   ```
   and open `clearspec/<unit>/mockups/index.html`.

## Reset a project

From inside the project folder. This deletes the run's output (`clearspec/` and anything else created) and restores the committed files:

```bash
git checkout -- . && git clean -fd
```

`node_modules` and the skill copy are git-ignored, so they stay.

## After changing the skill

From this folder, copy the current skill into every project:

```bash
node sync-skill.mjs
```

It copies `SKILL.md`, `references/`, `assets/`, and `scripts/`, never `evals/`.
