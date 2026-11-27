---
name: clearspec
description: Turns an idea or half-written requirement into one consolidated REQUIREMENTS.md plus offline mockups (UI screens, API reference, or CLI transcripts). Researches the codebase and how established products solve the problem first, then asks only the product and technical questions that change what gets built.
argument-hint: "[idea text | idea file | --next-phase | --revise]"
disable-model-invocation: true
allowed-tools: Bash(node ${CLAUDE_SKILL_DIR}/scripts/check.mjs *) Bash(node ${CLAUDE_SKILL_DIR}/scripts/serve.mjs *) Bash(node ${CLAUDE_SKILL_DIR}/scripts/export.mjs *) Bash(node ${CLAUDE_SKILL_DIR}/scripts/cli-render.mjs *) Bash(node ${CLAUDE_SKILL_DIR}/scripts/wireframe/*.mjs *)
---

# clearspec

Turn `$ARGUMENTS` into a spec a coding agent can build from without follow-up questions, plus mockups that show every requirement and edge case.

```
Idea → 1. Context (no questions) → 2. Product questions → 3. Technical questions
     → 4. REQUIREMENTS.md → 5. Mockups → 6. Check
```

Paths like `references/…` are relative to `${CLAUDE_SKILL_DIR}`. Output goes to `clearspec/<kebab-name>/`:

```
clearspec/<name>/
├── REQUIREMENTS.md      the one deliverable: intent, decisions, phases, FRs, ECs, assumptions
└── mockups/             UI: index.html (compare page) + SCR-*.html, specs/, inventory.md, final/
                         API: api.html + openapi.yaml · CLI: cli.html + transcripts.md
    └── assets/          API/CLI pages only: theme.css, fixtures.js, app.js
```

## Rules

1. **Facts are yours, decisions are theirs.** Never ask what the repo, attached files, the web, or a standard can answer. Never decide scope, priorities, or trade-offs for the developer.
2. **Every question must earn its place.** Run the question gate in `references/questions.md` before each one. A detail with a defensible standard default is an assumption (`A-n`), not a question.
3. **No quota.** There is no minimum. Typical runs ask 5–12 questions. Stop when you can predict the developer's next answers.
4. **Ask through the picker** (`AskUserQuestion`; plain numbered text without it). Up to 3 independent questions per call; never batch a question whose options depend on another unanswered one.
5. **Each question shows once,** as the last thing in your message. No recap of it afterwards.
6. **Write state to disk.** After the context step, keep `REQUIREMENTS.md` as the working file: draft §1–2 early, fill decisions as they settle. After a context compaction, re-read it before acting.
7. **Mockups work offline.** No CDN, network, or web fonts.
8. **The check script gates completion:** `node ${CLAUDE_SKILL_DIR}/scripts/check.mjs clearspec/<name>` exits 0.

IDs: `FR-n` requirement, `EC-n` edge case, `D-n` decision, `A-n` assumption. With modules, FR/EC/A take a module prefix (`BOOK-FR-3`). IDs are permanent: never renumber; retire with "(removed)".

## 1. Context (no questions yet)

Do this before asking anything. Run both lookups in parallel, with fresh-context subagents when available:

- **Codebase scan** (skip if the folder is empty): stack, existing features that overlap the idea, data models, auth, UI kit and design tokens, API and CLI conventions, anything half-built. At most 25 lines back.
- **Prior-art scan** (web search, 2–4 searches): how 2–3 established products or standards solve this; the domain's known hard problems (the things that go wrong in real use); the standard feature set; any relevant spec (RFC, clig.dev, WCAG, payment or privacy rules). At most 25 lines back, with source links.

Then show the developer a **context brief**, at most 15 lines:

```
What I found
- Repo: <what exists that this touches or reuses>
- How others do it: <product A does X, product B does Y>
- Hard problems in this domain: <2–4, e.g. no-shows hold rooms empty; recurring bookings>
- My read: <one-sentence hypothesis of what you want and why> · confidence <n>%
```

Classify the type (UI, API, CLI, mixed) and create `REQUIREMENTS.md` from `assets/requirements-template.md` with §1 and the Context section filled. The hard problems you found are the raw material for your best questions.

## 2. Product questions

Read `references/questions.md`. Work from the riskiest unknown down: is this the right problem, for whom, what ships first, what is out, then the domain's hard problems as concrete scenarios. Record each answer as `D-n` in §Decisions as it lands.

**Switch to technical questions when all three hold:**
- you can write the restate (outcome, user, why now, success, out of scope) in the developer's own words;
- Phase 1 scope and the non-goals are agreed;
- what is left is about *how*, not *what, who, or why*.

Exception: a hard constraint that changes scope ("must run offline", "reuse our Auth0 tenant", "data stays in the EU") is asked as soon as it surfaces, because it reshapes the product questions.

## 3. Technical questions

Only at **fork points**: places where the repo and the standards do not settle it, and the answer changes the data model, a contract, or user-visible behavior. The list is in `references/questions.md` § Technical. Many runs need 0–4. Never ask hosting, CI, framework, or vendor choices the repo already fixes.

**Confirm gate.** One message: the restate (6 lines), then every assumption you took (`A-n`, one line each, with its default). Ask: confirm, or name the ones to change. Fold changes in. Write `Status: Confirmed` on the spec's status line only after an explicit yes.

## Phases and modules

**Phases (always considered).** The "what ships first" product question decides them. Phase 1 is the thinnest slice where a user completes the core job end to end (walking skeleton). If the developer wants it all at once, there is one phase. Every FR carries `Phase: n`. Phase 1 is specified in full; later phases are one bullet per capability in §Delivery plan until `--next-phase` details them.

**Modules (only on signals).** Treat an area as a module only when it meets two or more: different people or vocabulary; owns its own data; useful if shipped alone; would need its own 10+ questions. With 2+ qualifying areas, ask once: one spec with module sections *(recommended)*, or spec the most important module now and outline the rest. Never infer modules from how big the idea sounds. Modules stay in the same `REQUIREMENTS.md` as `##` sections under §Functional requirements, with ID prefixes.

**Size limit.** If Phase 1 exceeds about 25 Must FRs or 12 mockup artifacts, ask which to move to Phase 2.

## 4. Write REQUIREMENTS.md

Fill the template. Every FR has an ID, priority, phase, Given/When/Then, and `Source:` decision IDs; every edge case raised becomes an `EC-n` with concrete fixture values. FRs say what the user observes; technology goes in §Technical decisions. Then self-review once against this list and fix what fails:

- Two statements that cannot both hold; one rule stated twice.
- An FR a developer could build two different ways (missing limit, unit, role, or failure behavior).
- A criterion that cannot pass or fail by observation, or a vague word with no number.
- A role, entity, or flow with no FR; a decision cited by nothing.
- A word used against the glossary.

## 5. Mockups

List the artifacts (screens, endpoint groups, or command groups), at most 12, each with its states, and every EC mapped to a state. Show the list in one message and go ahead unless the developer objects.

### UI: wireframes

UI mockups are grayscale wireframes drawn from small JSON specs by a fixed component kit. **You never write HTML or CSS for UI screens.** Read `references/wireframe/kit.md`, `references/wireframe/recipes.md` and `references/wireframe/design-rules.md`, then:

1. Write `mockups/inventory.md`: the screens (id `SCR-<kebab>`, title, FRs, ECs, states with their keys) and the shared sample data (people, item names, numbers, dates) used on every screen. Anything undecided is `[TBD]`.
2. Write `mockups/specs/app.json` (name, user, nav with the exact screen names) and one `mockups/specs/screens/SCR-<kebab>.json` per screen. Each spec lists its requirements in `serves` and its edge cases in `edge`; every EC becomes a state of the screen where it happens.
3. Validate until it exits 0 (fix every ERROR; fix warnings when cheap):
   `node ${CLAUDE_SKILL_DIR}/scripts/wireframe/render.mjs clearspec/<name>/mockups/specs clearspec/<name>/mockups --no-kit`
4. Build the compare page: `node ${CLAUDE_SKILL_DIR}/scripts/wireframe/compare.mjs clearspec/<name>/mockups --flat`. It writes `mockups/index.html`: every screen at Dense, Standard and Roomy side by side.
5. In REQUIREMENTS.md refer to screens by id: an FR's `Shown in: SCR-x`, an EC's `State: SCR-x?state=<state key>`, and §Mockups lists the screens.

Do not ask a design-direction question and do not choose a density: wireframes are grayscale and the developer picks the density. The developer opens `mockups/index.html`, picks a density per screen and presses **Finalize selected**. That saves the chosen set to `mockups/final/` (specs, rendered screens, a README manifest) and adds a "UI mockups" section at the end of REQUIREMENTS.md telling whoever builds the UI to refer to it. Without a browser that can save to a folder: `node ${CLAUDE_SKILL_DIR}/scripts/wireframe/assemble.mjs clearspec/<name>/mockups '<selection json>' [--default standard]` does the same.

### API and CLI

Read `references/api-cli.md` and build:

1. Write `mockups/assets/fixtures.js` first: every name, ID, amount, and date any artifact shows.
2. Copy `${CLAUDE_SKILL_DIR}/assets/theme.css` and `app.js` into `mockups/assets/`, set the tokens, and run the check until contrast passes.
3. Build each artifact from `references/renderer.md`: with 4+ artifacts and a subagent tool, one subagent per artifact in parallel; otherwise one at a time here. CLI: write `mockups/transcripts.md`, then `node ${CLAUDE_SKILL_DIR}/scripts/cli-render.mjs clearspec/<name>`.
4. Fill `mockups/index.html` from `${CLAUDE_SKILL_DIR}/assets/index.html`.

## 6. Check and report

Run the check script until it exits 0; treat ambiguity warnings as wording to sharpen. Report in at most 10 lines: the path, counts (questions asked, FRs, ECs, assumptions, artifacts), the check summary line, how to view the mockups (open `mockups/index.html`; for UI, pick a density per screen and press Finalize selected; or `node ${CLAUDE_SKILL_DIR}/scripts/serve.mjs clearspec/<name>`), and the next phase if there is one. `node ${CLAUDE_SKILL_DIR}/scripts/export.mjs clearspec/<name>` writes single-file copies for sharing, on request.

## Later runs

- **`--next-phase`:** read the spec, take the next phase's bullets, run steps 2–6 for them only (questions start from what Phase 1 left open). New FRs continue the numbering; earlier IDs never change.
- **`--revise`** (or a change request): record the new decision, update the affected FRs and ECs, re-render only the affected artifacts (for UI, edit the affected screen specs and re-run `compare.mjs --flat`), run the check again. If `mockups/final/` exists, tell the developer it is stale until they Finalize again.

## Rationalizations

| Thought | Reality |
|---|---|
| "I should cover every area, so I'll ask about integrations." | Ask only if the answer changes the spec. "None in v1" is an assumption. |
| "I'll ask which time step they want." | A standard default exists. Log `A-n`; the confirm gate shows it. |
| "The idea is clear, skip the context step." | The context step is where the good questions come from. Always run it. |
| "The idea sounds big, so modules." | Modules need the signals, then the developer's choice. |
| "They accepted every recommendation, great." | Recommendations may be too safe. Your next question should be one they would disagree with. |
