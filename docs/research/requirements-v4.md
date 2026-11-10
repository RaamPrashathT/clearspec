# Requirements: `/spec-it`, an Idea-to-Spec Skill for Claude Code

Status: Draft v4 · 2026-11-03

Research basis:
- [docs/skill-authoring-research.md](docs/skill-authoring-research.md)
- [docs/interview-design.md](docs/interview-design.md)
- [docs/ui-generation-research.md](docs/ui-generation-research.md)

## 1. Summary

`/spec-it` is a Claude Code skill. It takes a raw idea for a new product or feature and turns it into two things:

1. **Artifacts that fit the product type:**
   - high-fidelity HTML screens for products with a UI
   - a rendered API reference plus an OpenAPI draft for APIs
   - styled terminal transcripts for CLIs
2. **One consolidated `REQUIREMENTS.md`,** written mainly for a **coding agent** to build from.

To get there, the skill interviews the developer about ambiguous areas and edge cases. The number of questions scales with the size of the idea. The interview method is our own, combining the best techniques from Addy Osmani, Matt Pocock and poteto (see `docs/interview-design.md`).

## 2. People

| Role | Who | Needs |
|---|---|---|
| **Runner** | A developer in a Claude Code terminal | A short, sharp interview and reviewable artifacts |
| **Primary reader** | A coding agent that builds from the spec | Stable IDs, testable acceptance criteria, no ambiguity, and explicit assumptions |
| Secondary reader | The developer's team | Readable prose and artifacts they can show stakeholders |

## 3. Goals and non-goals

**Goals**
- Find ambiguity, missing edge cases and hidden assumptions before any code is written.
- Spend the question budget on high-impact decisions only, with no duplicates.
- Make artifacts realistic enough to show stakeholders, with every edge case visible as a state.
- Produce a spec a coding agent can build from without asking follow-up questions.
- Keep the skill token-efficient and safe against context loss over long runs (§12).

**Non-goals (Phase 1)**
- No web app or GUI. The tool is a Claude Code skill only.
- No ticket or task breakdown, and no tracker integration.
- No production code. Artifacts are references, not code to ship.
- No deep technical design. The spec is **product-level first** (§9).
- No full existing-app mode yet (Phase 2, §15).

## 4. Phases

| Phase | Scope |
|---|---|
| **Phase 1 (v1)** | **New products, and new features described on their own** (UI, API, CLI). The skill may read an existing repo for facts such as stack, tokens and terms, but the spec describes the feature as a whole, not as a change. |
| **Phase 2** | **Existing-app mode:** a change spec, a code-first interview, screens in the real app shell (§15). |

## 5. Form factor

- **Package:** a folder at `.claude/skills/spec-it/` (project-level, §14) containing `SKILL.md`, `references/`, `assets/`, `scripts/` and `evals/` (§11). The folder name must equal `name`.
- **User-invoked only:** `disable-model-invocation: true`. The run is long and the developer starts it on purpose, so it adds nothing to the always-loaded skill listing.
- **Invocation:**
  - `/spec-it "<idea>"`
  - `/spec-it <file or folder>` (accepts a PRD, ticket text, notes, screenshots or sketches)
  - `/spec-it --resume <slug>`
- **Runtime:** Node.js for the check scripts. If Node is missing, the model runs the same checks by hand.

## 6. Workflow

| # | Phase | What happens | Output | Done when |
|---|---|---|---|---|
| 1 | **Intake** | Read the idea and any attached files. A subagent reads the repo for facts. Classify the **product type** (UI / API / CLI / mixed) and **size** (S / M / L, see §7.2). Write a one-sentence hypothesis, a confidence %, what's missing, and the starting assumptions. Seed the decision tree. | `00-intake.md`, `01-decisions.md` | Type, size, hypothesis and tree are written down. |
| 1b | **Scope check (L only)** | Propose a module split (modules, what each owns, build order) and ask: **"Split into modules, or continue as one spec?"** | Decision in the log | The developer chose. |
| 2 | **Interview** | Run the §7 method within the size budget. | `01-decisions.md` | The budget is spent, or the stop test passes, or the developer says "enough". Then the restate gets an explicit yes. |
| 3 | **Synthesize** | Turn decisions into FRs, edge cases (EC), data, NFRs and the glossary. Contradictions are resolved with at most 3 extra questions, which don't count toward the budget. | Draft spec | Every decision maps to at least one FR, EC or assumption. |
| 4 | **Artifact inventory** | List the screens, endpoints or commands (8–12 at most, §14), each with its **state matrix** (one state per EC). The developer confirms. | Inventory (spec §10) | The developer approves the list. |
| 5 | **Design and render** | Write fixtures, the design plan and tokens, then render the artifacts in subagents (§8). | `screens/`, `api/` or `cli/` | Every inventory item exists and passes the §8 checks. |
| 6 | **Consolidate** | Write `REQUIREMENTS.md` (§9). Run `check.mjs` (§11) and fix until it passes. | `REQUIREMENTS.md` | The check passes. |
| 7 | **Revise** | Apply the developer's changes to the spec and the affected artifacts in one pass, then re-run the check. | Updated files | The check passes again. |

The skill saves state to disk after every phase, and `--resume` continues from the last finished phase.

## 7. Interview

The full method is in [docs/interview-design.md](docs/interview-design.md). It becomes `references/interview.md`, condensed and in our own words, with MIT credit lines.

### 7.1 Core rules

- **FR-Q1, design tree and frontier.** Questions come only from the frontier: open decisions whose prerequisites are already settled. A later answer that contradicts a settled node reopens it.
- **FR-Q2, small rounds.** A round has **up to 3 independent questions**, numbered so the developer can reply with something like "1 yes, 2 B, 3 no because…".
  - The first round is always **one** premise question.
  - Two questions never share a round when one depends on the other.
- **FR-Q3, question format.** Each question has a title, a body, and a `➡️ Recommended:` line with a one-line reason, worded so "yes" accepts it.
  - The recommendation is sometimes deliberately contrarian, to catch agreeable answers.
  - Edge cases are asked as concrete scenarios with names from the fixtures.
- **FR-Q4, facts vs decisions.** Facts (from the repo, files or environment) are looked up by a fresh-context subagent and never asked. Only decisions go to the developer.
- **FR-Q5, probes.** These probes come from the interview design doc:
  - **Want vs. should want:** for buzzword answers ("scalable", "modern"), ask what the developer would want if they didn't have to justify it.
  - **Vague to testable:** restate a vague goal as a measurable criterion.
  - **Sharpen fuzzy terms:** pin down an ambiguous word and add the result to the glossary.
  - **Premise check:** the first round asks whether this is the right thing to build at all.
- **FR-Q6, delegation.** "Whatever you think" gets two concrete options once. If it comes back again, it's logged as `assumed`.
- **FR-Q7, provenance.** Each decision records its source:
  - `own`: the developer's own answer
  - `accepted`: the developer took the recommendation
  - `assumed`: delegated or skipped

  If more than 70% are `accepted`, the skill says so before the restate and asks which ones the developer actually cares about.
- **FR-Q8, progress line.** Each round starts with a line like `Round 4 · Q9–11 of ~20 · Edge cases · confidence 65%`.
- **FR-Q9, ask format.** Plain text by default. `AskUserQuestion` only for a pure 2–4 option choice; fall back to text when it's unavailable.
- **FR-Q10, stop and confirm.** Stop when you can predict the next 3 answers (once past the size floor), when the budget is spent, or on "enough". Then write the 6-line restate (Outcome, User, Why now, Success, Constraint, Out of scope) and wait for an explicit yes. "Sounds good" doesn't count.

### 7.2 Size-based budget

| Size | Signals at intake | Budget |
|---|---|---|
| **S** | One flow, 1–2 roles, a handful of entities | 8–12 questions |
| **M** | Several flows or roles, real data lifecycle | 15–25 questions |
| **L** | Several independently testable capabilities (e.g. accounts + billing + reporting) | Propose a module split (Phase 1b). **Split:** one interview of size S or M per module, each module getting its own FR section in the single spec. **Continue as one:** up to **40 questions**. |

- The developer can override the size in one word at intake.
- Coverage weights by lens are defined in the interview design doc (premise, roles and scope, flows and data, edge cases, success and NFRs).
- Rank questions by impact: hard to reverse × surprising later × a real trade-off.

## 8. Artifacts

### 8.1 Shared for all product types

- **FR-AR1, fixtures first.** Write `assets/fixtures.js` before any artifact. It holds the entities, IDs, names, amounts and dates, plus deliberate extremes: a 48-character name, a zero value, an overdue item, an empty list. Every artifact takes its values from it, so names and IDs can't drift between screens.
- **FR-AR2, state matrix.** Every EC in the spec maps to a visible state of at least one artifact. The check fails on an EC with no state.
- **FR-AR3, traceability.** Each element that implements a requirement carries `data-fr="FR-n"`, and each state carries `data-ec="EC-n"`.
- **FR-AR4, offline.** Plain HTML/CSS plus small vanilla JS. No CDN and no network; works from `file://`.
- **FR-AR5, render in subagents.** Each screen, endpoint group or command group renders in a fresh-context subagent. It receives only `DESIGN.md`, `theme.css`, `fixtures.js` and its own FRs and ECs. This keeps the main session lean and lets rendering run in parallel.
- **FR-AR6, model per role.** The strongest model handles the interview, design plan and critique. A cheaper model may render from a fixed plan.

### 8.2 UI products: screens

Details are in [docs/ui-generation-research.md](docs/ui-generation-research.md), which becomes `references/screens.md`.

- **FR-S1, mode.** Screens are in **Operate** mode (task-focused app UI). The visual style contributes four things only: type, palette, density and one signature move. Navigation and controls stay standard for the category.
- **FR-S2, design plan first.** `screens/DESIGN.md` holds:
  - 4–6 named OKLCH or hex colours
  - type families and their roles
  - a layout sentence plus an ASCII sketch
  - the signature move
  - three principles
  - the AI tells this plan rejects, and why

  Run the genericness test ("would I make this same plan for any similar product?") and revise. The developer confirms the direction in one question, which counts toward the budget.
- **FR-S3, tokens.** `theme.css` uses semantic roles over primitives, with a 4 px spacing base. `check.mjs` computes WCAG contrast for every declared foreground/background pair and fails below AA.
- **FR-S4, quality floor:**
  - WCAG 2.2 AA (contrast, `:focus-visible`, targets at least 24 px, reflow at 320 px, never colour alone)
  - semantic HTML
  - labelled controls
  - `aria-live` on toasts and inline validation
  - `prefers-reduced-motion`
  - `tabular-nums` in number columns
  - body measure 65–75 characters
  - sentence case
  - curly quotes and `…` in UI copy
  - inline SVG icons from one consistent set
  - themed browser surfaces (selection, scrollbars, focus rings)
- **FR-S5, refuse AI tells.** The list in the UI research doc §3.4 is a default to avoid unless the developer asks for it.
- **FR-S6, copy.**
  - Use the user's terms.
  - Buttons say what they do, and the action keeps the same name through the flow.
  - Errors give the cause and the fix.
  - Empty states invite the next action.
- **FR-S7, URL switchers.** Each screen supports `?state=` (from the state matrix) and `?stress=1` (fixture extremes plus about 35% longer strings), with a small floating switcher. Pressing `A` toggles the FR/EC overlay.
- **FR-S8, variants (optional).** The primary screen can get 2–3 structurally different layouts via `?variant=`, if the developer says yes in the design question.
- **FR-S9, fonts.** Use a deliberate system font stack, or one of a small set of SIL-OFL `woff2` families bundled in `assets/fonts/` (at most 4 families, at most 600 KB in total).
- **FR-S10, look and critique (when a browser is available).** Serve `screens/` on localhost and screenshot it at 375 and 1440 px. A fresh-context critic subagent returns Nielsen 0–4 scores, AI-tell findings, a squint-test verdict and the top 5 fixes. Apply them in one batch.
- **FR-S11, navigation.** `index.html` lists the screens in flow order, with the FRs covered by each shown first. `design-system.html` shows the tokens and components.

### 8.3 API products

- **FR-API1, reference page.** `api/index.html` is a rendered reference. Per endpoint it shows:
  - purpose and FRs
  - auth
  - request and response examples built from the fixtures
  - pagination and filtering
  - every error case as a state (`data-ec`), with status code and body
- **FR-API2, OpenAPI draft.** `api/openapi.yaml` is an OpenAPI 3.1 draft consistent with the page, so the coding agent has a machine-readable contract.
- **FR-API3, same rules.** The page follows the same quality floor and design system rules as screens, in reading mode.

### 8.4 CLI products

- **FR-CLI1, transcripts.** `cli/index.html` holds styled terminal transcripts per command:
  - `--help` output
  - the happy path
  - every error state (`data-ec`) with its message and **exit code**
  - interactive prompts, if any
  - output formats (human-readable and `--json`, if in scope)
- **FR-CLI2, real data.** Transcripts use fixture data and real-looking paths. The same `?state=` and `?stress=1` switchers apply.

## 9. `REQUIREMENTS.md` (agent-first, product-level)

The skill fills `assets/requirements-template.md` in this order:

0. **How to use this spec (for coding agents).** Covers:
   - the read order
   - the ID scheme (`FR-n`, `EC-n`, `D-n`, `A-n`)
   - "Must" means required for done
   - artifacts are visual and behavioural reference, not code to copy
   - `fixtures.js` doubles as seed and test data
   - assumptions (`A-n`) need confirmation before you build on them
   - definition of done: every Must FR's acceptance criteria pass
1. Overview and problem statement
2. Goals, non-goals and success metrics, each falsifiable
3. Users, personas, and a roles and permissions matrix
4. **Glossary** of resolved terms, used consistently throughout
5. User flows: numbered steps, optionally with Mermaid diagrams
6. **Functional requirements.** Each one has:
   - an ID and a priority (Must / Should / Could)
   - a description
   - Given / When / Then acceptance criteria
   - its source decisions (`D-n`)
   - the artifacts and states that show it
7. **Edge cases (`EC-n`).** Each one gives the scenario, the expected behaviour, its linked FR, and its artifact state.
8. Data model at the product level: entities, fields, relationships, validation rules and lifecycle
9. NFRs: performance, security, privacy, accessibility and i18n, as testable criteria
10. Artifact index: item, file, states, FRs and ECs covered
11. **Constraints and boundaries.** Lists only what the developer stated:
    - stack and integration constraints
    - Always / Ask first / Never rules for the coding agent

    No other technical design.
12. Design direction, with a link to `DESIGN.md` (UI products)
13. Assumptions (`A-n`), each with the recommended default
14. Open questions and risks
15. **Decision log (`D-n`).** Every question and answer, with provenance (`own`, `accepted` or `assumed`) and rationale.

For API products, the endpoint list and the error contract count as product-level, because they are the product.

## 10. Output layout

```
specs/<idea-slug>/
  00-intake.md
  01-decisions.md
  REQUIREMENTS.md
  assets/
    fixtures.js
    theme.css
    fonts/            # only if a bundled face is chosen
    app.js            # state/stress/variant switchers, FR/EC overlay
  screens/            # UI products
    index.html
    design-system.html
    DESIGN.md
    01-<screen>.html ...
  api/                # API products
    index.html
    openapi.yaml
  cli/                # CLI products
    index.html
```

## 11. Skill package layout

```
spec-it/
  SKILL.md                      # critical rules + phase steps (§12 budget)
  references/
    interview.md                # Phases 1-2
    screens.md                  # Phases 4-5, UI
    api-cli.md                  # Phases 4-5, API and CLI
    critic.md                   # brief for the critic subagent
    renderer.md                 # brief for each render subagent
  assets/
    requirements-template.md
    theme.css  app.js  screen.html  index.html  fonts/
  scripts/
    check.mjs                   # Node, zero dependencies
  evals/
    evals.json
    personas/                   # hidden-requirement personas for evals
```

- **FR-T1, `check.mjs specs/<slug>`.** Exits non-zero with specific messages, such as `FR-14 in 03-checkout.html not found. Known: FR-1..FR-13`. It checks:
  - **Trace:** an unknown `data-fr` or `data-ec`; a Must FR with no artifact; an EC with no state; an artifact missing from the index; a broken internal link; an FR without acceptance criteria; a decision that maps to nothing.
  - **Contrast:** every declared token pair meets AA.
  - **Lint:**
    - lorem ipsum
    - `outline: none` without a replacement
    - `transition: all`
    - an `<img>` without `alt` or dimensions
    - unlabelled inputs or icon buttons
    - `<div onclick>`
    - external URLs
    - `...` in UI copy
  - **API:** the routes in `openapi.yaml` match the endpoints on the page.

## 12. Skill authoring requirements

These apply to the skill's own files.

- **FR-A1, frontmatter.** `name: spec-it`, a one-line human `description` under 1,024 characters, `disable-model-invocation: true` and `argument-hint`. Nothing else beyond the portable fields.
- **FR-A2, size.** The `SKILL.md` body stays under 200 lines and about 2,500 tokens.
- **FR-A3, front-loading.** The first screen of `SKILL.md` holds the rules that must survive compaction:
  - the budget table
  - small rounds
  - facts vs decisions
  - the restate gate
  - the output paths
  - the resume rule
  - the gotchas (we don't call the external skills; we do render in subagents)
- **FR-A4, progressive disclosure.** Each reference is read at the start of its phase, through a pointer that says when. References sit one level deep, and any file over 100 lines starts with a table of contents.
- **FR-A5, state on disk.** Every phase writes its file before the next phase starts. Resume and compaction recovery read from `specs/<slug>/`.
- **FR-A6, subagents.** Repo scans, fact lookups, rendering and critique each run in a fresh context and return summaries, not raw dumps.
- **FR-A7, writing standard.**
  - one term per concept
  - rules phrased as the behaviour you want
  - a one-clause reason only where a rule looks arbitrary
  - no all-caps MUSTs
  - no em dashes
  - no no-op lines
- **FR-A8, model-neutral.** Describe the procedure, not one model's workaround.
- **FR-A9, verification.** `SKILL.md` ends with an exit checklist that needs evidence, plus a 4–6 row table of common rationalizations.

## 13. Acceptance criteria (v1)

1. **Budget:** for a one-line S, M and L idea, the question count stays inside the §7.2 budget. Rounds hold at most 3 independent questions, there are no duplicates, and every decision records its provenance.
2. **L ideas:** the skill proposes the module split and respects the developer's answer, capping at 40 questions when they choose to continue as one spec.
3. **No external skills needed:** the run completes with no external skills installed.
4. **UI:** screens use the shared fixtures and theme, and expose every EC as a `?state=`. A human reviewer judges that they look like a real product.
5. **API and CLI:** the API page and `openapi.yaml` agree, and CLI transcripts show exit codes for every error state.
6. **Spec and check:** `REQUIREMENTS.md` follows §9, and `check.mjs` passes.
7. **Revise:** changes update the spec and the affected artifacts together, and the check still passes.
8. **Package:** the skill meets FR-A1 to FR-A3, and `claude plugin validate` is clean.
9. **Evals:**
   - At least 3 behaviour cases: a UI idea, an API idea, and an L idea with contradictions.
   - Each case is run with and without the skill.
   - A persona subagent plays the developer from a hidden list of requirements and edge cases.
   - The score is the **share of hidden items the spec captured**. With the skill, it must beat the baseline by a clear margin.

## 14. Settled decisions

1. **Name:** `spec-it`, invoked as `/spec-it`. The folder name matches.
2. **Install scope:** project-level by default (`.claude/skills/spec-it/`, committed with the repo). Users who want it everywhere can copy or symlink it to `~/.claude/skills/`.
3. **Artifact cap:** 8–12 screens per run, and the same 8–12 range for endpoint groups or command groups. When the inventory goes over 12, the skill asks which items to drop or defer, and lists the deferred ones under Open questions in the spec.

## 15. Phase 2 backlog

- **Existing-app mode.** For requests like "add team invites to my app":
  - The spec describes the **change**: what's new, what changes, what's untouched.
  - The interview **starts from the code**: current flows, data and permissions are read first, and questions target the gap.
  - Screens **reuse the real app shell**: its header, nav, tokens and components, with new screens judged in context.
  - Intake accepts screenshots of the current app as the design brief.
- **Quick mode:** `/spec-it --quick`, about 8 questions and 3 key artifacts.
- **Deeper technical spec:** stack choices and internal API contracts, as an optional add-on.
