# Requirements: Splitly

Status: Confirmed · Type: UI · Date: 2026-11-03 · Phases: 1 · Modules: none

<!-- For the coding agent: read §1–4 for intent, §Glossary for names, §Functional requirements and §Edge cases for behavior, §Mockups for what it looks like. IDs are permanent. Done means every Must FR in the current phase passes its Given/When/Then and every linked EC behaves as stated. Confirm each A-n before building on it. Mockups are visual and behavioral reference: match them, do not copy their code. fixtures.js doubles as seed and test data. -->

## 1. Overview

Roommates lose track of who paid for shared bills, and the group chat ends up as the accounting system. Splitly keeps one running ledger per household and lets people record paybacks.

Restate:
- Outcome: A shared ledger showing who owes whom, with settle-up.
- User: Roommates, 2–8 per household.
- Why now: The group chat is the accounting system.
- Success: Anyone sees their balance in under 5 seconds.
- Constraint: Records paybacks only; no money moves in the app.
- Out of scope: Payments, multi-currency.

## 2. Context

- Repo: empty project.
- Prior art: Splitwise · running balances and settle-up · we take the balance view, reject in-app payments.
- Hard problems in this domain: an amount edited while someone settles up (EC-1).

## 3. Users and roles

| Role | Who | Can | Cannot |
|---|---|---|---|
| Member | A roommate in the household | Add expenses, record paybacks | Delete other members |

## 4. Delivery plan

| Phase | Ships | Done when |
|---|---|---|
| 1 | Balances and settle-up | A member sees their balance and records a payback |

## 5. Glossary

- **Household**: the group that shares a ledger. Not "group".

## 6. User flows

### Flow: Settle up
1. Raj opens the dashboard (01-dashboard) and sees he owes Ana.
2. Raj records a payback on the settle-up screen (02-settle-up).

## 7. Functional requirements

### FR-1 · Must · See balances
The dashboard lists each member's net balance.
Phase: 1
- Given Raj owes Ana $42.50
- When Raj opens the dashboard
- Then he sees "You owe Ana Souza $42.50"
Source: D-1
Shown in: mockups/01-dashboard.html

### FR-2 · Must · Record a payback
A member records that they paid someone back.
Phase: 1
- Given Raj owes Ana $42.50
- When Raj records a payback of $42.50 to Ana
- Then both balances show $0.00
Source: D-1, D-2, D-3
Shown in: mockups/02-settle-up.html

### FR-3 · Should · Single currency
All amounts use USD.
Phase: 1
- Given any expense
- When it is displayed
- Then it is formatted as USD
Source: D-4
Shown in: none (no UI)

## 8. Edge cases

### EC-1 · Amount changed during settle-up
Scenario: Mei edits the internet bill from $60.00 to $75.00 while Raj is settling up.
Expected: Raj sees a warning with the new amount before confirming.
Linked: FR-2
State: mockups/02-settle-up.html?state=amount-changed

### EC-2 · Nobody owes anything
Scenario: All balances are $0.00.
Expected: The dashboard says everyone is settled and offers "Add expense".
Linked: FR-1
State: mockups/01-dashboard.html?state=all-settled

## 9. Data model

| Entity | Key fields | Relationships | Rules | Lifecycle |
|---|---|---|---|---|
| Expense | id, title, amount, paidBy, date | belongs to Household | amount > 0 | editable until settled |

## 10. Non-functional requirements

- Accessibility: WCAG 2.2 AA.

## 11. Technical decisions

- Constraints from the repo: none yet; empty project (D-5).

## 12. Design direction

- Use scene: roommates on phones in a bright kitchen.
- Theme: light. Palette: neutral paper, ink text, teal action. Type: system stack. Density: compact.
- Layout: one column list of balances.
- Signature move: balances read as "who → whom" lines.
- Rejected defaults: card grid for balances; purple accent.

## 13. Mockups

| Artifact | File | States | FRs | ECs |
|---|---|---|---|---|
| 01 Dashboard | mockups/01-dashboard.html | populated, all-settled | FR-1 | EC-2 |
| 02 Settle up | mockups/02-settle-up.html | normal, amount-changed | FR-2 | EC-1 |

## 14. Assumptions

- A-1 · USD only · default: USD · from D-4

## 15. Open questions and risks

- None.

## Decisions

| ID | Decision | Answer | Provenance | Why |
|---|---|---|---|---|
| D-1 | Core job | Running balances plus settle-up | own | The pain is history, not calculation |
| D-2 | Money movement | Record paybacks only | accepted | Payments are a different product |
| D-3 | Changed amount | Warn and show the new amount before confirming | own | Prevents paying back a stale amount |
| D-4 | Currency | USD only | assumed | Standard default for one household |
| D-5 | Stack | No code yet | fact | Empty repo |
