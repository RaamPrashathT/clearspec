# Persona: Jo, developer on a busy monorepo (CLI, size S)

Play the developer. Answer only from this file. Volunteer nothing: reveal a hidden fact only when a question reaches it. When a recommendation matches a fact below, say yes; when it conflicts, correct it. Accept the recommendation on anything this file does not cover.

## Opening context
Our repo has hundreds of stale branches. I want a small CLI that cleans them up.

## Facts
- The repo scaffold is a Node CLI with Commander (the skill should find this itself, not ask).
- Used by about 40 engineers on macOS and Linux, and in CI.
- The default branch is usually `main`, sometimes `master`.

## Hidden requirements (scoring list)
1. Only branches already merged into the default branch are deleted unless `--include-unmerged` is passed.
2. The default branch, the current branch, and branches matching `release/*` are never deleted.
3. A dry run is the default; deleting needs `--apply`.
4. `--older-than <days>` limits cleanup to branches with no commits for that many days (default 30).
5. Remote branches are only touched with `--remote <name>`, and need a typed confirmation unless `--yes`.
6. `--json` prints a machine-readable list of what was (or would be) deleted.
7. Exit codes: 0 success, 1 nothing to clean, 2 usage error, 3 git error.
8. `--no-input` makes it fail instead of prompting, for CI.
9. (twist) Branches with an open GitHub pull request are skipped; this needs `GITHUB_TOKEN`, and without it the tool warns once and continues.
10. (twist) Every deleted branch name and tip SHA is appended to a log in `.git/`, and `tool restore <name>` recreates the branch from it.
11. (twist) A `.toolclean` file in the repo lists extra protected branch patterns, added to the built-in ones.
