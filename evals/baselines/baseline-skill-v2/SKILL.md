---
name: spec-it
description: Interviews you about an idea, then writes a REQUIREMENTS.md for coding agents plus realistic offline mockups (screens, API reference, or CLI transcripts).
argument-hint: "[idea text | idea file | --next | --resume N]"
disable-model-invocation: true
allowed-tools: Bash(node ${CLAUDE_SKILL_DIR}/scripts/check.mjs *) Bash(node ${CLAUDE_SKILL_DIR}/scripts/serve.mjs *) Bash(node ${CLAUDE_SKILL_DIR}/scripts/export.mjs *) Bash(node ${CLAUDE_SKILL_DIR}/scripts/cli-render.mjs *)
---

# spec-it

Turn `$ARGUMENTS` into a spec a coding agent can build from without follow-up questions, plus artifacts that show every requirement and edge case.

Skill directory: `${CLAUDE_SKILL_DIR}`. Paths like `references/…`, `assets/…`, and `scripts/…` below are relative to it; `<skill dir>` in the reference files means this path.

## Rules for the whole run

1. **The developer decides; you never assume.** Structure (modules, phases), scope, and every product decision are asked, not inferred. Never conclude "this is big" from user counts or how an idea sounds.
2. **Facts are yours.** Look up anything the repo, attached files, or environment can answer, with a fresh-context subagent when your environment has one, otherwise inline. Never ask the developer a fact.
3. **One question at a time.** Each question is one picker call (or one text block without a picker): the recommended answer, up to 2 alternatives, and "Explain with an example"; free text through Other. Format and explain flow: `references/interview.md`.
4. **Show each question exactly once,** as the last thing in your message. Never restate it in a recap, a closing message, or an end-of-turn box or buttons the host app adds.
5. **Budgets** per unit: S 8–12 · M 15–25 · one large unit up to 40. Explains, contradiction checks (`X`), checkpoints (`C`), and the technical round (`T`, 0–8, sensitive points only) sit outside the budget.
6. **The product gate:** every coverage area is Clear or Assumed, and the restate has an explicit "yes". "Sounds good" gets "Anything you'd refine?".
7. **State lives on disk.** Each phase ends by writing its file. After `--resume`, `--next`, or a context compaction, re-read `spec-it/roadmap.md` and the unit folder before acting.
8. **This skill carries its own method.** Do not invoke `grill-me`, `grilling`, `interview-me`, `spec-driven-development`, or pstack skills.
9. **Artifacts work offline:** no CDN, no network, no web fonts from the internet.
10. **The check script gates completion:** `node ${CLAUDE_SKILL_DIR}/scripts/check.mjs spec-it/<unit>` after rendering and after every revision. A phase with errors is not done.

IDs: `FR-n` requirement, `EC-n` edge case, `D-n` decision, `A-n` assumption. With modules, FR, EC, and A carry the module prefix (`BOOK-FR-3`). IDs are permanent: never renumber; retire with "(removed)".

## Layout

```
spec-it/
├── roadmap.md            always: shape, limits, units and status, map, parked questions, deferred
├── shared/               only with 2+ units: design.md and assets/ (theme, fixtures) as the source for new units
└── 1-<name>/             one unit: the whole product, one module, or one phase of a module
    ├── REQUIREMENTS.md   the deliverable
    ├── decisions.md      intake, coverage, every question and answer, glossary, restate
    ├── design.md         UI design direction
    └── mockups/          what the developer opens: index.html, screens, api.html + openapi.yaml,
        └── assets/       cli.html + transcripts.md; theme.css, fixtures.js, app.js; export/ for sharing
```

Units are numbered in the order they are specced. Every unit folder is self-contained.

## Start

- **No `spec-it/roadmap.md`:** a new product. Run all phases; the first unit is `1-<kebab-name>`.
- **`--next`:** read `roadmap.md`, take the first unit marked `upcoming`, and start at phase 1 with its parked questions first.
- **`--resume N`:** `N` is the number prefix of the unit folder (`1` for `1-habit-tracker`). Read that unit, find its last finished phase by "done when" below, continue with the next, and say which. If no folder starts with `N-`, stop and list the units from `roadmap.md`.
- **A roadmap exists and a new idea is given:** ask whether it is a new unit of this product or a separate product (then use a different folder name and ask where).

## Phases

| # | Phase | Read first | Done when |
|---|---|---|---|
| 1 | Intake | `references/interview.md` | `decisions.md` has type, facts, hypothesis, and coverage table |
| 2 | Discovery | | the discovery questions the request leaves open are answered |
| 3 | Shape | `references/structure.md` | shape recorded in `roadmap.md` (1M1P needs no question) |
| 4 | Interview | | product gate passed |
| 5 | Technical round | | taken or declined |
| 6 | Synthesize and review | `assets/requirements-template.md`, `references/reviewer.md` | `REQUIREMENTS.md` drafted and reviewer fixes applied |
| 7 | Inventory | `references/screens.md` or `references/api-cli.md` | developer approved the artifact list |
| 8 | Design and render | `references/renderer.md`, `references/critic.md` | every inventory item exists |
| 9 | Consolidate | | check exits 0, export written, roadmap updated |
| 10 | Revise | | check exits 0 again |

### 1. Intake
Read the idea and any attached files. Collect repo facts with a subagent (stack, existing UI and tokens, domain terms, data models, auth; at most 30 lines back) and wait for it before asking anything. Classify the product type (UI, API, CLI, mixed). Write the top of `decisions.md` per `references/interview.md` § decisions.md. Create `roadmap.md` if it does not exist.

### 2. Discovery
Ask only the discovery questions in `references/interview.md` § Discovery that the request does not already answer; skip the phase when it answers all of them. Then set the size and budget, and tell the developer in one line.

### 3. Shape
Check the module signals in `references/structure.md`. If they do not hold, the shape is one module, one phase: record it and move on without a question. If they hold, ask the shape checkpoint, then the phase checkpoint only when its condition holds. Show the table, timeline, or grid the chosen shape uses, and write it to `roadmap.md`.

### 4. Interview
Run the loop in `references/interview.md` for the current unit until the product gate passes, then the restate gate.

### 5. Technical round
Find the sensitive points and offer the technical round only if one matches (`references/interview.md` § Technical round). If taken, ask only the questions those points produce; repo facts answer first.

### 6. Synthesize and review
Fill `assets/requirements-template.md` into `REQUIREMENTS.md`. Every FR gets an ID, a priority, Given/When/Then, and `Source:` decisions; every edge case raised becomes an `EC-n`. Then run the reviewer in `references/reviewer.md` and apply its fixes once. Resolve contradictions with at most 3 `X` questions.

### 7. Inventory
List the artifacts (screens, endpoint groups, or command groups), at most 12 per unit, each with its states. Every EC maps to a state. Over 12: ask which to drop or defer to a later unit (record it in `roadmap.md`). Write the list to §10 and get approval.

### 8. Design and render
1. Write `mockups/assets/fixtures.js` with every value any artifact shows. With 2+ units, start from `shared/assets/fixtures.js`.
2. UI: write `design.md` per `references/screens.md` (with 2+ units, follow `shared/design.md`). API and CLI: follow `references/api-cli.md`.
3. Ask one picker question for the design direction (UI, counts toward the budget), then the build-mode checkpoint: **in parallel subagents** *(recommended when available)* or **here, one at a time**. Skip the build-mode question when no subagent tool exists.
4. Copy `${CLAUDE_SKILL_DIR}/assets/theme.css` and `app.js` into `mockups/assets/`, set the tokens, and run the check script until contrast passes.
5. Build each artifact from `references/renderer.md`. Subagent mode: one per artifact, in parallel, one report when all return. Inline mode: one at a time, keeping only each return summary in mind. CLI: write `mockups/transcripts.md`, then run `node ${CLAUDE_SKILL_DIR}/scripts/cli-render.mjs spec-it/<unit>`.
6. Fill `mockups/index.html` from `${CLAUDE_SKILL_DIR}/assets/index.html`, run the check script, and fix every error. Treat ambiguity warnings as questions to settle or wording to sharpen.
7. UI critique is optional and depends on a browser tool. If a browser tool is available, run `references/critic.md` and apply its fixes in one batch; if screenshots fail, run its source-only fallback. If no browser tool is available, skip the screenshot critique and write `Critic skipped: no browser tool.` in the report.

### 9. Consolidate
Complete §0, §10, and §12 of `REQUIREMENTS.md`. Run the check script until it exits 0, then `node ${CLAUDE_SKILL_DIR}/scripts/export.mjs spec-it/<unit>` for the shareable single-file copies. Update the unit's row in `roadmap.md` to `done`, and with a second unit coming, create `shared/` per `references/structure.md`.

Report: the unit path, counts (questions, FRs, ECs, assumptions, artifacts), the check summary line, the assumptions to confirm, and how to view the artifacts: open `mockups/index.html` in a regular browser, or `node ${CLAUDE_SKILL_DIR}/scripts/serve.mjs spec-it/<unit>` and the printed URL (some editor preview panes load local HTML without its CSS); `mockups/export/` holds single files to send to others. If `roadmap.md` lists an upcoming unit, end with one picker question: continue with it now *(recommended)*, or stop here (`/spec-it --next` later).

### 10. Revise
For each change request: record new decisions (ask only what the request leaves open), update the affected FRs and ECs, re-render only the affected artifacts in the chosen build mode, then run the check script and the export again.

## Exit checklist

Show evidence for each line in the final report:
- [ ] `Q` count in `decisions.md` is inside the unit's budget; `T` count is at most 8.
- [ ] Every coverage area is Clear or Assumed, and `Confirmed: yes` is recorded under the restate.
- [ ] Every decision carries provenance (`own`, `accepted`, `assumed`, `fact`).
- [ ] Check script summary line shows 0 errors.
- [ ] UI: look-and-critique ran, or the report says why not.

## Rationalizations

| Thought | Reality |
|---|---|
| "The idea is clearly big, so I'll set up modules." | Structure is the developer's call. Ask at the shape checkpoint, only when the signals hold. |
| "The request is clear enough to skip questions." | Skip only the discovery questions it answers. The coverage table shows what is still open. |
| "I'll fill this gap with a sensible default." | A default you chose is an assumption: log it as `A-n` so the coding agent confirms it. |
| "Placeholder text is fine for a mockup." | Placeholder text hides overflow and wrapping bugs. Use the fixtures. |
| "The check script is strict; this error doesn't matter." | The coding agent trusts the trace. Fix it or change the spec. |
