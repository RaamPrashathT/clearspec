# clearspec test projects

Small project scaffolds the evals run the skill against. They're plain folders in this repo; every run copies one into a fresh git repo outside it, so these stay clean.

| Project | Contents | Tests | Example rough idea |
|---|---|---|---|
| `01-react-tailwind` | Vite, React 19, TypeScript, Tailwind 4 (default palette, no custom tokens) | stack detection, UI, design from scratch | "a habit tracker for my team" |
| `02-empty` | nothing but `.gitignore` | greenfield, no repo facts to find | any idea |
| `03-express-api` | Express 5, Zod, TypeScript, one `/health` route | API artifacts, OpenAPI agreement | "an API for booking meeting rooms" |
| `04-node-cli` | Node ESM CLI with Commander, `bin: tool` | CLI transcripts, exit codes | "a CLI to clean up old git branches" |
| `05-react-design-system` | "Plotline" agency app: React + Tailwind with custom `@theme` tokens, Button, Input, StatusBadge, AppShell, a Projects table | reusing existing tokens and shell | "let clients approve deliverables" |
| `06-mixed` | React + Tailwind `web/` and Express `server/` as npm workspaces, `/api` proxied | mixed artifacts, shared fixtures | "meeting room booking with a partner API" |

Don't put notes inside a project folder: the skill scans the project, and a note there would leak into the run.

## Automated runs

`node evals/run-persona.mjs <case id> --arm both` from the repo root. See [../README.md](../README.md). Results go to `_runs/` (git-ignored).

## Try the skill by hand

```bash
node evals/test-projects/try-project.mjs 04-node-cli
```

It copies the project to a temp folder, commits it, installs the current skill into its `.claude/skills/`, and prints the path. Open Claude Code there, run `/clearspec "your rough idea"`, and answer as yourself. Then check the result from that folder:

```bash
node .claude/skills/clearspec/scripts/check.mjs clearspec/<name>
```

and open `clearspec/<name>/mockups/index.html`. Pass `--skill-dir evals/baselines/baseline-skill-v2` to try an older version.
