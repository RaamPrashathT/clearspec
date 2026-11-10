# Decisions: Splitly
Unit: 1-splitly · Type: UI · Size: S · Budget: 8-12 · Technical budget: 5-8

## Intake
HYPOTHESIS: Roommates want to see who owes whom and record paybacks, without a spreadsheet.
CONFIDENCE: 40% (missing: split rules, what happens on move-out)
Repo facts:
- Empty repo.
Inputs read:
- None.

## Coverage
| Area | Status | Decisions |
|---|---|---|
| Scope and roles | Clear | D-1, D-2 |
| Data and lifecycle | Clear | D-1 |
| Flows and states | Clear | D-3 |
| Quality needs | Assumed | A-1 |
| Integrations | Clear | D-2 |
| Edge cases | Clear | D-3 |
| Terminology | Clear | D-1 |
| Success measures | Clear | D-1 |

## Tree
- D-1 [settled] Core job · own · Q1
  Answer: Running balances plus settle-up.
  Why: The pain is history, not calculation.
- D-2 [settled] Money movement · accepted · Q2
  Answer: Record paybacks only; no money moves in the app.
  Why: Payments are a different product.
- D-3 [settled] Settle-up with changed amount · own · Q3
  Answer: Warn and show the new amount before confirming.
  Why: Prevents paying back a stale amount.
- D-4 [assumed] Currency · assumed · Q4 · A-1
  Answer: USD only.
- D-5 [fact] Stack · fact
  Answer: No code yet.

## Glossary
- Household: the group that shares a ledger.

## Restate
- Outcome: A shared ledger showing who owes whom, with settle-up.
- User: Roommates, 2-8 per household.
- Why now: The group chat is the accounting system.
- Success: Anyone sees their balance in under 5 seconds.
- Constraint: Records paybacks only.
- Out of scope: Payments, multi-currency.

Confirmed: yes
