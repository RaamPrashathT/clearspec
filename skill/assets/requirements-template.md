# Requirements: <Product or feature name>

Status: Draft | Confirmed · Type: <UI | API | CLI | mixed> · Date: <YYYY-MM-DD> · Phases: <n> · Modules: <none | list>

<!-- For the coding agent: read §1–4 for intent, §Glossary for names, §Functional requirements and §Edge cases for behavior, §Mockups for what it looks like. IDs are permanent. Done means every Must FR in the current phase passes its Given/When/Then and every linked EC behaves as stated. Confirm each A-n before building on it. Mockups are visual and behavioral reference: match them, do not copy their code. fixtures.js doubles as seed and test data. CLI: mockups/transcripts.md is a snapshot test suite. API: mockups/openapi.yaml is the contract. -->

## 1. Overview

<Problem from the user's side, 2–4 sentences. The solution in 1–2 sentences.>

Restate:
- Outcome: <…>
- User: <…>
- Why now: <…>
- Success: <a number>
- Constraint: <…>
- Out of scope: <…>

## 2. Context

- Repo: <what exists that this touches or reuses; or "empty project">
- Prior art: <product or standard · what it does · what we take or reject> (source links)
- Hard problems in this domain: <each, with the EC or FR that handles it>

## 3. Users and roles

| Role | Who | Can | Cannot |
|---|---|---|---|
| <role> | <description> | <actions> | <actions> |

## 4. Delivery plan

| Phase | Ships | Done when |
|---|---|---|
| 1 | <thinnest end-to-end slice> | <user completes the core job> |
| 2 | <one line per capability> | <…> |

<!-- With modules, add: | Module | Owns | Depends on | Order |. Later phases stay one line per capability until --next-phase details them. -->

## 5. Glossary

- **<Term>**: <definition and boundary>. Not "<rejected synonym>".

## 6. User flows

### Flow: <name>
1. <step, naming the screen, endpoint, or command>

## 7. Functional requirements

<!-- With modules: one "### Module: <name>" heading per module, FRs below it with the module prefix. -->

### FR-1 · Must · <short title>
<One sentence.>
Phase: 1
- Given <context>
- When <action>
- Then <observable outcome>
Source: D-1
Shown in: mockups/02-dashboard.html

<!-- Priority: Must, Should, Could. Use "Shown in: none (no UI)" when there is no surface. -->

## 8. Edge cases

### EC-1 · <short title>
Scenario: <concrete, with fixture names and values>
Expected: <behavior>
Linked: FR-1
State: mockups/07-move-out.html?state=blocked-balance

## 9. Data model

| Entity | Key fields | Relationships | Rules | Lifecycle |
|---|---|---|---|---|
| <Entity> | <fields with types> | <relations> | <validation> | <create, edit, delete, retention> |

## 10. Non-functional requirements

Only those with a number or a named standard: performance, privacy, accessibility (WCAG 2.2 AA by default), locales.

## 11. Technical decisions

- <decision> · <why> · changes FR-n · from D-n
- Constraints from the repo: <stack, auth, conventions>
- Boundaries for the coding agent: Always <…> · Ask first <…> · Never <…>

## 12. Design direction

<UI: use scene, theme, palette roles, type, density, layout sketch, signature move, rejected defaults. If the repo has a design system: name it and say "follow it". Others: "Not applicable.">

## 13. Mockups

| Artifact | File | States | FRs | ECs |
|---|---|---|---|---|
| <NN name> | mockups/NN-name.html | populated, empty | FR-1 | EC-1 |

## 14. Assumptions

- A-1 · <assumption> · default: <what we do> · from D-n

## 15. Open questions and risks

- <question or risk, and who decides>

## Decisions

| ID | Decision | Answer | Provenance | Why |
|---|---|---|---|---|
| D-1 | <title> | <answer> | own | <one line> |

<!-- Provenance: own, accepted, assumed, fact. Every NFR and success metric carries a number. Avoid "fast", "easy", "intuitive", "robust", "seamless", "user-friendly", "as appropriate", "etc.", "TBD", "and/or": the check script flags them. -->
