# Requirements: <Product or feature name>

Spec ID: <slug> · Status: Draft | Final · Date: <YYYY-MM-DD> · Type: <UI | API | CLI | mixed> · Size: <S | M | L>

## 0. How to use this spec

This spec is written for a coding agent that builds the product.

- Read in order: §1–3 for intent, §4 for vocabulary, §6 and §7 for behavior, §10 for the artifacts.
- IDs are permanent: `FR-n` requirement, `EC-n` edge case, `D-n` decision, `A-n` assumption.
- Done means: every Must FR's acceptance criteria pass, and every EC behaves as stated.
- Artifacts in §10 are visual and behavioral reference. Match what they show; do not copy their code.
- `assets/fixtures.js` doubles as seed data and test data.
- Confirm each `A-n` with the developer before building on it.
- Use the glossary terms exactly, in code names and UI copy.

## 1. Overview

<Problem from the user's perspective, in 2–4 sentences. The solution in 1–2 sentences.>

## 2. Goals, non-goals, success metrics

Goals:
- <goal>

Non-goals:
- <explicitly out of scope, from the restate>

Success metrics:
- <falsifiable: a number, a time, a count>

## 3. Users and roles

| Role | Who | Can | Cannot |
|---|---|---|---|
| <role> | <description> | <actions> | <actions> |

## 4. Glossary

- **<Term>**: <definition and boundary>. Not "<rejected synonym>".

## 5. User flows

### Flow: <name>
1. <step, naming the screen, endpoint, or command>
2. <step>

## 6. Functional requirements

### FR-1 · Must · <short title>
<One-sentence description.>
- Given <context>
- When <action>
- Then <observable outcome>
Source: D-1, D-4
Shown in: screens/02-dashboard.html

<!-- Priority is Must, Should, or Could. Use "Shown in: none (no UI)" for requirements with no visible surface. -->

## 7. Edge cases

### EC-1 · <short title>
Scenario: <concrete scenario with fixture names and values>
Expected: <behavior>
Linked: FR-1
State: screens/07-move-out.html?state=blocked-balance

## 8. Data model

| Entity | Key fields | Relationships | Rules | Lifecycle |
|---|---|---|---|---|
| <Entity> | <fields with types> | <relations> | <validation> | <create, edit, delete, retention> |

## 9. Non-functional requirements

- **Performance:** <testable criterion>
- **Security and privacy:** <criterion>
- **Accessibility:** WCAG 2.2 AA
- **i18n:** <locales, formats>

## 10. Artifact index

| Artifact | File | States | FRs | ECs |
|---|---|---|---|---|
| <NN name> | screens/NN-name.html | populated, empty | FR-1, FR-2 | EC-1 |

## 11. Constraints and boundaries

Only what the developer stated or the repo fixes.

- Stack and integrations: <facts>
- Always: <rule>
- Ask first: <rule>
- Never: <rule>

## 12. Design direction

<UI products: two lines summarizing the direction, then a link to screens/DESIGN.md. Others: "Not applicable.">

## 13. Assumptions

- A-1 · <assumption> · default: <the recommended answer> · from D-n

## 14. Open questions and risks

- <question or risk, with who decides>

## 15. Decision log

| ID | Decision | Answer | Provenance | Q |
|---|---|---|---|---|
| D-1 | <title> | <answer> | own | Q1 |
