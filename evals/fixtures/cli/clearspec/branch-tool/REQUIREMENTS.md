# Requirements: tool clean

Status: Confirmed · Type: CLI · Date: 2026-11-04 · Phases: 1 · Modules: none

<!-- For the coding agent: read §1–4 for intent, §Glossary for names, §Functional requirements and §Edge cases for behavior, §Mockups for what it looks like. IDs are permanent. Done means every Must FR in the current phase passes its Given/When/Then and every linked EC behaves as stated. Confirm each A-n before building on it. CLI: mockups/transcripts.md is a snapshot test suite. -->

## 1. Overview

The team's repo has hundreds of stale branches, and nobody deletes them because a wrong delete loses work. `tool clean` lists merged, stale branches and deletes them only when asked.

Restate:
- Outcome: One command that safely removes stale branches.
- User: Engineers and CI.
- Why now: Hundreds of stale branches.
- Success: Under 50 stale branches within 30 days of rollout.
- Constraint: Never deletes unmerged work by default.
- Out of scope: A GUI.

## 2. Context

- Repo: Node CLI scaffold with Commander, bin "tool".
- Prior art: git-trim · dry run first, then delete · we take the dry-run default.
- Hard problems in this domain: a remote that doesn't exist (EC-1).

## 3. Users and roles

| Role | Who | Can | Cannot |
|---|---|---|---|
| Engineer | Runs the command in their clone | List and delete stale branches | Delete unmerged branches by default |

## 4. Delivery plan

| Phase | Ships | Done when |
|---|---|---|
| 1 | List and delete stale branches | An engineer removes stale branches in one run |

## 5. Glossary

- **Stale branch**: merged into the default branch and no commits for 30 days. Not "old branch".

## 6. User flows

### Flow: Clean up
1. The engineer runs `tool clean` and reviews the list.
2. The engineer runs `tool clean --apply` to delete them.

## 7. Functional requirements

### FR-1 · Must · List stale branches
A plain run lists merged branches with no commits for 30 days, and deletes nothing.
Phase: 1
- Given fix/login is merged and last committed 2026-08-02
- When the user runs `tool clean`
- Then fix/login is listed and nothing is deleted
Source: D-1, D-2
Shown in: mockups/cli.html

### FR-2 · Must · Delete with --apply
A run with `--apply` deletes the listed branches.
Phase: 1
- Given fix/login is listed
- When the user runs `tool clean --apply`
- Then fix/login is deleted and the command exits 0
Source: D-2
Shown in: mockups/cli.html

## 8. Edge cases

### EC-1 · Remote not found
Scenario: `tool clean --remote origin` in a repo with no remote named origin.
Expected: An error on stderr naming the flag to pass, exit 2.
Linked: FR-2
State: mockups/cli.html?state=no-remote

## 9. Data model

| Entity | Key fields | Relationships | Rules | Lifecycle |
|---|---|---|---|---|
| Branch | name, lastCommit, merged | belongs to a repo | the default and current branch are never stale | read from git on each run |

## 10. Non-functional requirements

- Performance: lists 500 branches in under 2 s (A-1).

## 11. Technical decisions

- Remote branches are touched only with `--remote <name>` · keeps the default run local · changes FR-2 · from D-3
- Constraints from the repo: Node with Commander (D-5).

## 12. Design direction

Not applicable.

## 13. Mockups

| Artifact | File | States | FRs | ECs |
|---|---|---|---|---|
| tool clean | mockups/cli.html | list, apply, no-remote | FR-1, FR-2 | EC-1 |

## 14. Assumptions

- A-1 · 500 branches in under 2 s · default: 2 s · from D-4

## 15. Open questions and risks

- None.

## Decisions

| ID | Decision | Answer | Provenance | Why |
|---|---|---|---|---|
| D-1 | Deletion boundary | Merged local branches only | own | Unmerged work must never be lost |
| D-2 | Dry run by default | A plain run lists; --apply deletes | own | A wrong delete is the main fear |
| D-3 | Remote handling | Only with --remote <name>; exit 2 when the remote is missing | own | Remote deletes affect the team |
| D-4 | Performance target | 500 branches in under 2 s | assumed | Large repos must stay usable |
| D-5 | Stack | Node with Commander | fact | Repo scaffold |
