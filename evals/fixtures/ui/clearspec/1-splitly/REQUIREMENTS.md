# Requirements: Splitly

Spec ID: sample-ui · Status: Final · Date: 2026-11-03 · Type: UI · Size: S

## 0. How to use this spec

This spec is written for a coding agent that builds the product.

- IDs are permanent: `FR-n` requirement, `EC-n` edge case, `D-n` decision, `A-n` assumption.
- Done means: every Must FR's acceptance criteria pass, and every EC behaves as stated.
- Artifacts in §10 are visual and behavioral reference. Match what they show; do not copy their code.
- `assets/fixtures.js` doubles as seed data and test data.

## 1. Overview

Roommates lose track of who paid for shared bills. Splitly keeps one running ledger per household and lets people record paybacks.

## 2. Goals, non-goals, success metrics

Goals:
- Everyone sees their balance at a glance (D-1).

Non-goals:
- Moving money inside the app (D-2).

Success metrics:
- A member finds their balance in under 5 seconds.

## 3. Users and roles

| Role | Who | Can | Cannot |
|---|---|---|---|
| Member | A roommate in the household | Add expenses, record paybacks | Delete other members |

## 4. Glossary

- **Household**: the group that shares a ledger. Not "group".

## 5. User flows

### Flow: Settle up
1. Raj opens the dashboard and sees he owes Ana.
2. Raj records a payback on the settle-up screen.

## 6. Functional requirements

### FR-1 · Must · See balances
The dashboard lists each member's net balance.
- Given Raj owes Ana $42.50
- When Raj opens the dashboard
- Then he sees "You owe Ana Souza $42.50"
Source: D-1
Shown in: mockups/01-dashboard.html

### FR-2 · Must · Record a payback
A member records that they paid someone back.
- Given Raj owes Ana $42.50
- When Raj records a payback of $42.50 to Ana
- Then both balances show $0.00
Source: D-1, D-2, D-3
Shown in: mockups/02-settle-up.html

### FR-3 · Should · Single currency
All amounts use USD.
- Given any expense
- When it is displayed
- Then it is formatted as USD
Source: D-4
Shown in: none (no UI)

## 7. Edge cases

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

## 8. Data model

| Entity | Key fields | Relationships | Rules | Lifecycle |
|---|---|---|---|---|
| Expense | id, title, amount, paidBy, date | belongs to Household | amount > 0 | editable until settled |

## 9. Non-functional requirements

- **Accessibility:** WCAG 2.2 AA

## 10. Artifact index

| Artifact | File | States | FRs | ECs |
|---|---|---|---|---|
| 01 Dashboard | mockups/01-dashboard.html | populated, all-settled | FR-1 | EC-2 |
| 02 Settle up | mockups/02-settle-up.html | normal, amount-changed | FR-2 | EC-1 |

## 11. Constraints and boundaries

- Stack and integrations: none yet (D-5).

## 12. Design direction

Light, compact ledger. See design.md.

## 13. Assumptions

- A-1 · USD only · default: USD · from D-4

## 14. Open questions and risks

- None.

## 15. Decision log

| ID | Decision | Answer | Provenance | Q |
|---|---|---|---|---|
| D-1 | Core job | Running balances plus settle-up | own | Q1 |
| D-2 | Money movement | Record only | accepted | Q2 |
| D-3 | Changed amount | Warn first | own | Q3 |
| D-4 | Currency | USD | assumed | Q4 |
| D-5 | Stack | No code | fact | |
