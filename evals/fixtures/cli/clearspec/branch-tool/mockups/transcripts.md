# CLI: tool

## Exit codes
| Code | Meaning |
|---|---|
| 0 | success |
| 1 | nothing to clean |
| 2 | usage error |

## tool clean · FR-1 FR-2
Lists merged branches older than 30 days; deletes them with --apply.

### list · FR-1
```console
$ tool clean
Would delete 2 branches (run with --apply):
  fix/login      last commit 2026-08-02
  feat/old-nav   last commit 2026-07-15
[exit 0]
```

### apply · FR-2
```console
$ tool clean --apply
Deleted 2 branches: fix/login, feat/old-nav
[exit 0]
```

### no-remote · EC-1 · FR-2
```console
$ tool clean --remote origin
! error: no remote named "origin". Check `git remote -v` and pass --remote <name>.
[exit 2]
```
