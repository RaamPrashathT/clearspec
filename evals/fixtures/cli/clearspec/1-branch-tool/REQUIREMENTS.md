# Requirements: tool

Unit: 1-branch-tool · Module: — · Phase: 1 · Status: Final · Date: 2026-11-04 · Type: CLI · Size: S

## 0. How to use this spec
- CLI products: `mockups/transcripts.md` is a snapshot test suite.

## 2. Goals, non-goals, success metrics
Success metrics:
- Under 50 stale branches within 30 days of rollout (D-2).

## 6. Functional requirements

### FR-1 · Must · List stale branches
A plain run lists merged branches with no commits for 30 days, and deletes nothing.
- Given fix/login is merged and last committed 2026-08-02
- When the user runs `tool clean`
- Then fix/login is listed and nothing is deleted
Source: D-1, D-2
Shown in: mockups/cli.html

### FR-2 · Must · Delete with --apply
- Given fix/login is listed
- When the user runs `tool clean --apply`
- Then fix/login is deleted and the command exits 0
Source: D-2
Shown in: mockups/cli.html

## 7. Edge cases

### EC-1 · Remote not found
Scenario: `tool clean --remote origin` in a repo with no remote named origin.
Expected: an error on stderr naming the flag to pass, exit 2.
Linked: FR-2
State: mockups/cli.html?state=no-remote

## 9. Non-functional requirements
- **Performance:** lists 500 branches in under 2 s (A-1).

## 11. Constraints and technical decisions
- Stack: Node with Commander (D-5). Remote handling per D-3.

## 13. Assumptions
- A-1 · 500 branches in under 2 s · default: 2 s · from D-4

## 15. Decision log
| ID | Decision | Answer | Provenance | Asked |
|---|---|---|---|---|
| D-1 | Deletion boundary | merged only | own | Q1 |
| D-2 | Dry run by default | A plain run lists; --apply deletes | own | Q2 |
| D-3 | Remote handling | Only with --remote <name>; exit 2 when the remote is missing | own | Q3 |
| D-4 | Performance target | 500 branches in under 2 s (A-1) | assumed | Q4 |
| D-5 | Stack | Node with Commander | fact | repo |
