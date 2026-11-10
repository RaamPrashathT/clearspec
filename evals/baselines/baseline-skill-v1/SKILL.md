---
name: spec-it
description: Interviews you about an idea, then writes a REQUIREMENTS.md for coding agents plus realistic offline mockups (screens, API reference, or CLI transcripts).
argument-hint: "[idea text | idea file or folder | --resume slug]"
disable-model-invocation: true
allowed-tools: Bash(node ${CLAUDE_SKILL_DIR}/scripts/check.mjs *) Bash(node ${CLAUDE_SKILL_DIR}/scripts/serve.mjs *)
---

# spec-it

Turn `$ARGUMENTS` into `specs/<slug>/`: a spec a coding agent can build from without follow-up questions, plus artifacts that show every requirement and edge case.

Skill directory: `${CLAUDE_SKILL_DIR}`. Paths like `references/…`, `assets/…`, and `scripts/…` below are relative to it; `<skill dir>` in the reference files means this path.

## Rules for the whole run

1. **Facts are yours, decisions are the developer's.** Look up anything the repo, attached files, or environment can answer, using a fresh-context subagent when your environment has one, otherwise inline. Put only decisions to the developer.
2. **Question budget by size:** S 8–12 · M 15–25 · L: propose a module split first; if the developer keeps one spec, up to 40. Contradiction checks (at most 3), `explain N` follow-ups, and revise-phase questions sit outside the budget.
3. **Small rounds.** Up to 3 independent questions per round, numbered. Round 1 is a single premise question. Each question gives concrete context, lettered options with one marked *(recommended)*, and why it matters; `yes` accepts the round's recommendations. Use the format in `references/interview.md` § Question format.
4. **Show each round exactly once,** as the last thing in your message. Never restate it in a recap, a closing message, or an end-of-turn question box or buttons the host app adds.
5. **The interview ends on an explicit "yes"** to the 6-line restate. "Sounds good" gets "Anything you'd refine?".
6. **State lives on disk.** Each phase ends by writing its file. After `--resume` or a context compaction, re-read `specs/<slug>/` before acting.
7. **This skill carries its own method.** Do not invoke `grill-me`, `grilling`, `interview-me`, `spec-driven-development`, or pstack skills; their techniques are already in `references/`.
8. **Artifacts work offline** from `file://`: no CDN, no network, no web fonts from the internet.
9. **The check script gates completion.** Run `node ${CLAUDE_SKILL_DIR}/scripts/check.mjs specs/<slug>` after rendering and after every revision. A phase with errors is not done.

IDs: `FR-n` requirement, `EC-n` edge case, `D-n` decision, `A-n` assumption, `Qn` question. IDs are permanent: never renumber, retire with "(removed)".

## Start

- `--resume <slug>`: read `specs/<slug>/`, find the last finished phase by its "done when" below, and continue with the next one. Say which phase you are resuming.
- Otherwise derive a short kebab-case slug from the idea. If `specs/<slug>/` exists, ask whether to resume it or pick a new slug.

## Phases

| # | Phase | Read first | Writes | Done when |
|---|---|---|---|---|
| 1 | Intake | `references/interview.md` | `00-intake.md`, `01-decisions.md` | type, size, budget, hypothesis, and seeded tree are on disk |
| 1b | Scope check (L only) | | decision in `01-decisions.md` | developer chose split or one spec |
| 2 | Interview | | `01-decisions.md` | budget spent or stop test passes, and the restate is marked `Confirmed: yes` |
| 3 | Synthesize | `assets/requirements-template.md` | `REQUIREMENTS.md` (draft) | every settled `D-n` is cited by an FR, EC, A, or non-goal |
| 4 | Inventory | `references/screens.md` or `references/api-cli.md` | §10 of `REQUIREMENTS.md` | developer approved the list |
| 5 | Design and render | `references/renderer.md`, `references/critic.md` | `assets/`, `screens/` or `api/` or `cli/` | every inventory item exists |
| 6 | Consolidate | | final `REQUIREMENTS.md` | check script exits 0 |
| 7 | Revise | | updated files | check script exits 0 again |

### 1. Intake
1. Read the idea and any attached files (PRD, ticket text, notes, screenshots, sketches).
2. Collect repo facts with a fresh-context subagent (inline if none is available): stack, existing UI and design tokens, domain terms, data models, auth. It returns a summary of at most 30 lines, not file contents. Wait for it before asking Q1, so its report never interrupts a round.
3. Classify the product type (UI, API, CLI, or mixed) and the size, per `references/interview.md` § Sizing.
4. Write `00-intake.md` and seed `01-decisions.md` in the formats from `references/interview.md`.
5. Tell the developer the type, size, and budget in two lines. One word from them overrides either.

### 1b. Scope check (L only)
Propose modules (name, what it owns, depends on, build order) in at most 10 lines, then ask: "Split into modules, or continue as one spec?" Split: run phases 2–3 per module at its own S or M budget, all modules in one `REQUIREMENTS.md`. Continue: one interview, up to 40 questions.

### 2. Interview
Run the loop in `references/interview.md` until its stop condition, then the restate gate. Reserve one question of the budget for the design direction (UI products, asked in phase 5).

### 3. Synthesize
Fill `assets/requirements-template.md` into `specs/<slug>/REQUIREMENTS.md`, sections 0–9 and 11–15. Every FR gets Given/When/Then and `Source:` decisions; every edge case raised in the interview becomes an `EC-n`. Resolve contradictions you find with at most 3 extra questions.

### 4. Inventory
List the artifacts (screens, endpoint groups, or command groups), at most 12, each with its states. Every EC maps to a state. Over 12: ask which to drop or defer, and list deferred items under Open questions. Write the list to §10 and get approval.

### 5. Design and render
1. Write `assets/fixtures.js` first (conventions in `references/screens.md` § Fixtures). It must hold every value any artifact will show, including other members' values on shared views. Every artifact reads its data from it.
2. UI: write `screens/DESIGN.md` per `references/screens.md` and run its genericness test. API/CLI: follow `references/api-cli.md`.
3. **Ask one round** in the interview format, with these questions:
   - The design direction (UI only; it counts toward the budget).
   - **How to build the artifacts** (outside the budget): **A. In parallel subagents** *(recommended when available)*: faster, and keeps this session's context small. **B. Here, one at a time**: works in any editor, but uses more of this session's context. Skip this question and use B when your environment has no subagent tool.
4. Copy `${CLAUDE_SKILL_DIR}/assets/theme.css` and `app.js` into `specs/<slug>/assets/`, set the tokens, and run the check script until the contrast section passes.
5. Build each artifact from the brief in `references/renderer.md`. Build `design-system.html` first when the artifacts depend on its components.
   - **A, subagents:** one fresh-context subagent per artifact, in parallel. Post no progress message per finished artifact; report once, when all are back.
   - **B, inline:** follow the brief yourself, one artifact at a time. After writing each file, keep only its return summary in mind, not its HTML.
6. Fill the index page from `${CLAUDE_SKILL_DIR}/assets/index.html`, then run the check script and fix every error.
7. UI with a browser tool available: run the look-and-critique pass in `references/critic.md` and apply its fixes in one batch. If screenshots fail, run its source-only fallback and say so in the final report.

### 6. Consolidate
Complete §0, §10, and §12 of `REQUIREMENTS.md`. Run the check script until it exits 0. Report: file paths, counts (questions, FRs, ECs, assumptions, artifacts), the check summary line, and the assumptions the developer should confirm. End with how to view the artifacts: open `specs/<slug>/screens/index.html` (or `api/`, `cli/`) in a regular browser, or run `node ${CLAUDE_SKILL_DIR}/scripts/serve.mjs specs/<slug>` and open the printed URL. Some editor preview panes load local HTML without its CSS, so recommend the server when the developer uses one.

### 7. Revise
For each change request: record new `D-n` (ask only what the request leaves open), update the affected FRs and ECs, re-render only the affected artifacts in the build mode chosen in phase 5, then run the check script.

## Exit checklist

Show evidence for each line in the final report:
- [ ] Question count from `01-decisions.md` is inside the budget.
- [ ] `Confirmed: yes` is recorded under the restate.
- [ ] Every decision carries provenance (`own`, `accepted`, `assumed`).
- [ ] Check script summary line shows 0 errors.
- [ ] UI: look-and-critique ran, or the report states that no browser tool was available.

## Rationalizations

| Thought | Reality |
|---|---|
| "The idea is clear enough to skip questions." | If you cannot write the outcome in one sentence with its constraint and non-goals, it is not clear. |
| "I'll fill this gap with a sensible default." | A default you chose is an assumption: log it as `A-n` so the coding agent confirms it. |
| "The budget floor is reached, so I can stop." | Stop when the stop test passes too, or the developer says "enough". |
| "Placeholder text is fine for a mockup." | Placeholder text hides overflow and wrapping bugs. Use the fixtures. |
| "The check script is strict; this error doesn't matter." | The coding agent trusts the trace. Fix it or change the spec. |
