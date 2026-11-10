# Contributing

## Layout rules

- The skill lives only in `plugins/clearspec/skills/clearspec/`. Apps copy it at build time; never edit a copy.
- `evals/` never ships: its personas hold the hidden requirements a test run must not see.
- Shared code goes in `packages/`; `apps/` only wire it together.

## Before you push

```bash
pnpm test
```

## Commit messages

One emoji ([gitmoji](https://gitmoji.dev)), then a short imperative summary:

| Emoji | Use for |
|---|---|
| 🎉 | First commit |
| ✨ | New feature |
| 🐛 | Bug fix |
| ♻️ | Refactor |
| 🚚 | Move or rename files |
| 📝 | Docs |
| 🧪 | Tests and evals |
| 👷 | CI |
| 🔧 | Config |
| ⬆️ | Dependency upgrade |
| 🔒️ | Security fix |
| 🏗️ | Architecture or structure |

Example: `✨ Add zip export for specs`
