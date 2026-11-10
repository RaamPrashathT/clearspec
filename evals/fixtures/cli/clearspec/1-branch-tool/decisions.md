# Decisions: Branch cleanup CLI
Unit: 1-branch-tool · Type: CLI · Size: S · Budget: 8-12 · Technical budget: 5-8

## Intake
HYPOTHESIS: Engineers want a safe command that removes merged, stale branches.
CONFIDENCE: 50% (missing: remote handling, exit codes)
Repo facts:
- Node CLI scaffold with Commander, bin "tool".
Inputs read:
- None.

## Coverage
| Area | Status | Decisions |
|---|---|---|
| Scope and roles | Clear | D-1 |
| Data and lifecycle | Clear | D-1 |
| Flows and states | Clear | D-2 |
| Quality needs | Assumed | A-1 |
| Integrations | Clear | D-3 |
| Edge cases | Clear | D-3 |
| Terminology | Clear | D-1 |
| Success measures | Clear | D-2 |

## Tree
- D-1 [settled] Deletion boundary · own · Q1
  Answer: Merged local branches only, unless --include-unmerged.
- D-2 [settled] Dry run by default · own · Q2
  Answer: A plain run lists; --apply deletes.
- D-3 [settled] Remote handling · own · Q3
  Answer: Only with --remote <name>; fails with exit 2 when the remote is missing.
- D-4 [assumed] Performance target · assumed · Q4 · A-1
- D-5 [fact] Stack · fact
  Answer: Node with Commander.

## Glossary
- Stale branch: merged into the default branch and no commits for 30 days.

## Restate
- Outcome: one command that safely removes stale branches.
- User: engineers and CI.
- Why now: hundreds of stale branches.
- Success: under 50 stale branches within a month.
- Constraint: never deletes unmerged work by default.
- Out of scope: a GUI.

Confirmed: yes
