# clearspec skill

The skill itself is `SKILL.md` with its `references/`, `assets/` and `scripts/`.

## Install in a project

```bash
mkdir -p .claude/skills && cp -r skill .claude/skills/clearspec
```

Then in Claude Code: `/clearspec "<idea>"`. The folder name must be `clearspec`, the same as `name:` in `SKILL.md`.

The web app and `npx clearspec connect` use this same folder: `cli-app` copies it in at publish time (`npm run sync-skill`), so there is one source of truth.
