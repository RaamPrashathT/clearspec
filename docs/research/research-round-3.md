# Research round 3: what else spec-it should do

Researched 2026-11-03. The core flow stays fixed: **idea or half requirement → questions → requirements + previews.** This doc covers your six topics, each with what the research says, the options, and a recommendation to discuss.

## Sources

| Source | What it showed |
|---|---|
| [GitHub spec-kit](https://github.com/github/spec-kit) (MIT, ~146k stars): `specify`, `clarify`, `plan`, `analyze`, `checklist` | The closest prior art. Product and technical specs are separate commands. Clarification asks one question at a time, at most 5, each with a recommended option. Spec quality is checked like "unit tests for English". Specs live in numbered folders (`specs/003-user-auth`). |
| [Kiro specs](https://kiro.dev/docs/specs/) | Three files per spec: `requirements.md` (EARS), `design.md`, `tasks.md`. Requirements come first, then design. Separate bugfix specs. |
| [OpenSpec](https://codemyspec.com/blog/openspec-explained) (Fission-AI) | Living specs plus `changes/` folders holding **delta specs** (ADDED / MODIFIED / REMOVED). Finished changes are merged ("synced") into the main specs and archived with a date prefix. |
| [BMAD method](https://www.augmentcode.com/guides/bmad-method-ai-development) | Analyst, PM and Architect agents: brief → PRD → architecture → "implementation readiness" review. Tracks scale by project size. |
| [clig.dev](https://clig.dev/) | The standard CLI design guidelines. |
| [Prism and Spectral](https://dev.to/lob/api-specification-design-with-spectral-and-prism-1ohn) (Stoplight), RFC 9457 | A mock server generated from OpenAPI, an OpenAPI linter, and the standard error-body format. |
| [trycmd](https://docs.rs/trycmd) and cram | CLI transcripts that also run as snapshot tests. |
| User story mapping, Jeff Patton ([summary](https://s.visual-paradigm.com/guide/the-complete-guide-to-user-story-mapping/)) | Backbone activities, walking skeleton, release slices. |
| DDD bounded contexts ([Microsoft](https://learn.microsoft.com/dotnet/architecture/microservices/architect-microservice-container-applications/identify-microservice-domain-model-boundaries)), business capabilities, [BPM2DDD](https://shura.shu.ac.uk/30781) | Heuristics for drawing module boundaries. |
| EARS, Alistair Mavin, Rolls-Royce ([FAQ](https://www.jamasoftware.com/blog/faq-adopting-ears-notation-to-improve-requirements-engineering/)) | Requirement sentence patterns. |
| Clarifying-question studies: [Is That Clear? (2026)](https://arxiv.org/html/2611.01087), [elicitation follow-up mistakes](https://arxiv.org/pdf/2507.02858), [coding-assistant clarification](https://arxiv.org/html/2507.21285v1) | Evidence on how clarifying questions affect people. |
| Claude Code `AskUserQuestion` tool schema | The picker's hard limits. |

---

## 1. Splitting into modules

**What exists.**
- Osmani's capability map: modules, what each owns, dependencies, build order. We already ask this question for L ideas.
- DDD's bounded-context heuristics. A boundary is likely where:
  - the vocabulary changes (the same person is a "User" in one area and a "Payer" in another);
  - each piece of data has one clear owner;
  - the area's responsibility can be said in one sentence;
  - the acceptance criteria could ship and be tested on their own.
- The BPM2DDD paper reports that capability-based decomposition combined with DDD is the most common approach.
- Story mapping puts user activities left to right (the "backbone") and release slices top to bottom.

**The idea worth taking.** Combine the two into one **2-D map**:
- **Columns are modules,** taken from the backbone activities.
- **Rows are phases,** taken from the release slices. Phase 1 is the walking skeleton, the thinnest version where a user can complete the whole journey.

One picture then answers both "which modules?" and "what ships in what order?", and it ties topic 1 directly to topic 3.

```
              Booking        Patient records   Invoicing      Reporting
Phase 1 MVP   book, cancel   view, notes       —              —
Phase 2       no-show rules  export            per-clinic     —
Phase 3       —              retention         insurance      utilisation
```

**Recommendation.**
- **When:** at intake, check the four boundary signals above. If two or more modules show up, the idea is L and gets the map.
- **How:** propose the map as one picker question: split into modules / keep one spec / adjust.
- **IDs:** when a run is split, prefix IDs with the module (`BOOK-FR-3`). Otherwise keep `FR-3`. The check script needs a small change to accept prefixes.
- **Output:** the map becomes `spec-it/map.md`, the index for the whole product.

## 2. API, CLI and mixed products

### What the artifacts should contain

**API products:**
- Use RFC 9457 problem details as the single error body shape.
- Optionally, offer the developer a **live mock** of the API with Prism (`npx @stoplight/prism-cli mock api/openapi.yaml`). They could then call the API before any code exists, which is the API equivalent of clickable screens. It needs a one-time download, so ask first.
- Lint `openapi.yaml` with Spectral when it's available. Our check script already compares the endpoints on the page with `openapi.yaml`.

**CLI products:**
- Fold the clig.dev checklist into `api-cli.md` as interview probes and transcript rules:
  - exit codes mapped to failure modes
  - stdout for output, stderr for errors
  - `--json` output kept stable
  - `--no-input` so it can run without prompts
  - `NO_COLOR` respected
  - secrets never passed as flags or env vars
  - confirmation scaled to how destructive the command is
  - config precedence: flags, then env vars, then project config, then user config
- **Transcripts that are also tests.** Emit the transcripts as `cli/transcripts.md` in a cram/trycmd-style format: command, expected output, exit code. A coding agent can then run them directly as snapshot tests. The previews become the acceptance tests, which is better than plain documentation.

**Mixed products** (for example a web app plus a public API):
- Both artifact sets share one `fixtures.js`.
- An FR can say `Shown in: screens/04-checklist.html, api/index.html`.
- The check script already handles several artifact folders. It just hasn't been tested on a mixed product.

### Testing the skill on these types

- Run the API case on `test-projects/03-express-api` and the CLI case on `04-node-cli`.
- Add a **`06-mixed`** project: React front end plus an Express API in one repo.
- Automate the runs with personas: a script starts a headless session (`claude -p`) per case, and a persona subagent answers from its file. Then score hidden-requirement recall with and without the skill. This uses the eval set that already exists (`evals/evals.json` and the personas).

## 3. Chronological phases

**What exists.**
- **spec-kit:** a numbered folder per feature (`specs/001-…`, `002-…`), each a full spec.
- **OpenSpec:** one living spec plus delta folders for changes, merged in afterwards. It's powerful, but its own changelog shows merge bugs: a file with two ADDED sections silently lost one.
- **Kiro:** a folder per named spec, with no ordering.

**Options.**
1. **Full spec per phase** (spec-kit style). Simple, but later phases repeat content.
2. **Phase 1 full, later phases as deltas** (OpenSpec style: ADDED / MODIFIED / REMOVED, each citing phase-1 IDs). No duplication, but an agent must read several files to know the whole product.
3. **Deltas plus a generated `CURRENT.md`** holding the merged truth. Best for readers, but it needs a merge step, and merging is where OpenSpec's bugs are.

**Recommendation.**
- **Now:** option 1, a full spec per phase, plus `spec-it/map.md` listing the phases in order and saying which one is current.
- **Phase 2 of the roadmap (existing-app mode):** option 2. The check script verifies that every MODIFIED or REMOVED ID exists in an earlier phase.
- **Skip option 3** until there are real users with three or more phases.

```
spec-it/
├── map.md                        modules × phases, current phase marked
├── phase-1-habit-tracker/        full spec: REQUIREMENTS.md, decisions.md, design.md, mockups/
└── phase-2-team-invites/         later: delta spec citing phase-1 IDs
```

## 4. Technical questions: when is product "enough"?

**What exists.**
- **spec-kit:** the product spec must be technology-agnostic. The technical plan is a separate step, with its own unknowns marked `NEEDS CLARIFICATION` and resolved through research first.
- **Kiro:** requirements, then design.
- **BMAD:** PM, then Architect, with an implementation-readiness review in between.

All three treat the move to technical as an **explicit gate**, never something the model drifts into.

**How to know product is enough.** Use spec-kit's coverage taxonomy as a checklist. During the interview, track each category as Clear / Partial / Missing / Assumed in `decisions.md`:
- scope and roles
- data and lifecycle
- user flows and states
- non-functional qualities
- integrations
- edge cases
- terminology
- completion signals

Product is "enough" when every product category is Clear or Assumed, and the restate has an explicit yes. That's an objective test, replacing the current "can I predict the next 3 answers?" judgement call.

**Then ask, as one picker question:** "The product spec is ready. Add a short technical round?"
1. **Short technical round** *(recommended)*: 5–8 questions, only about technical choices that change the spec: platform, hosting or data location, auth provider, integrations, scale and performance targets, offline behaviour, retention.
2. **Skip:** product only. Technical choices are listed as open questions for the coding agent.
3. **Full technical design:** out of scope for now (Phase 2 backlog).

**Rules for the technical round:**
- Repo facts answer first. A React + Tailwind repo is never asked "which framework?".
- Answers go into §11 Constraints and a new "Technical decisions" section. FRs stay technology-agnostic.
- It has its own budget, separate from the product budget.

## 5. Question UX: one at a time, with a picker

### Your proposal, mapped onto the picker's real limits

`AskUserQuestion` allows **1–4 questions per call** and **2–4 options per question**, a header of at most 12 characters, and an optional preview per option. It always adds an **"Other" free-text option automatically.** That fits your design almost exactly:

| Slot | Content |
|---|---|
| Option 1 | **The recommended answer**, labelled "(Recommended)", with its consequence in the description |
| Options 2–3 | Up to 2 alternatives |
| Option 4 | **"Explain with an example"** |
| Built in | **Other:** the developer types their own answer |

One adjustment: because "Explain" takes a slot, there are **at most 3 real answers** (recommended plus 2), not 4. If you want 3 alternatives, "Explain" would have to move into Other ("type `explain`"). I'd keep Explain as a visible option, since it's what you reached for twice in the run.

### The explain flow, as you described it

1. The developer picks "Explain with an example".
2. The skill answers in plain words: a short story with real names, what each option would mean in practice, and why the decision matters. There's no question at the end of that message.
3. The skill then asks with the picker: **"Did that make sense?"**
   - Yes, ask me the question again
   - Explain it differently
   - Other
4. Only after "yes" does the original question come back, with the same number. It doesn't count toward the budget again.

### Extra things the picker allows

- **Option previews** render when an option is focused. For the design-direction question, each layout option could show an ASCII sketch, so the developer compares layouts without leaving the chat.
- **Up to 4 questions per call:** independent frontier questions could go in one picker form. That gives "fast mode" without a wall of text.

### Trade-offs to decide knowingly

- **More turns.** One question per turn means 20 questions take about 20 turns, plus explains. Grouping 2–3 independent questions into one picker form keeps the picker's neatness at roughly a third of the turns. **Recommendation: one picker call per round, 1–3 questions per call,** with the premise question always on its own.
- **The picker pushes toward multiple choice.** Pocock rejects pickers for exactly this reason. "Other" keeps free text possible. Open questions such as "what does success look like?" keep a suggested answer as option 1 and rely on Other.
- **Recommendations can lower vigilance.** The 2026 "Is That Clear?" study found that answering clarifying questions raised users' sense of being understood but lowered how much they verified the result. Keep the provenance tracking, the 70% check and the occasional contrarian recommendation.
- **Not every harness has a picker.** Without one (other editors, `claude -p`), fall back to the text format already in `interview.md`: same structure, lettered options, reply by letter.

## 6. Other ideas, ranked by value for effort

| # | Idea | Source | Value | Effort |
|---|---|---|---|---|
| 1 | **Coverage map** (taxonomy Clear/Partial/Missing) drives question choice and the product-done gate | spec-kit `clarify` | High: objective stop test, visible gaps | Low |
| 2 | **Ambiguity lint** in `check.mjs`: flag "fast", "easy", "intuitive", "robust", "user-friendly", "as appropriate", "etc.", "TBD", "and/or", and NFRs without a number | spec-kit taxonomy, ISO/IEC/IEEE 29148 qualities | High: deterministic and free | Low |
| 3 | **Spec critic pass** after synthesis: duplication, contradictions, underspecified FRs, coverage gaps, run by a fresh-context reviewer | spec-kit `analyze`, "unit tests for English" | High: catches what the interview missed | Low |
| 4 | **Self-contained export** of the mockups (single-file HTML with CSS, JS and data inlined) for sharing with a boss or client | our run (the preview-pane issue) | High for sharing | Low |
| 5 | **CLI transcripts as tests**, cram/trycmd style | trycmd, cram | High for CLI products | Low |
| 6 | **EARS phrasing** for each FR's rule sentence ("WHEN a member back-fills a day, THE SYSTEM SHALL mark it back-filled"), with Given/When/Then kept for acceptance | Kiro, Mavin | Medium: more precise rule sentences | Low |
| 7 | **Module × phase map** (`map.md`), optionally rendered as an HTML story map | Patton, capability maps | Medium to high for L ideas | Medium |
| 8 | **Optional live API mock** via Prism | Stoplight | Medium: a clickable API | Low, needs a download |
| 9 | **Pre-mortem question** in the premise round: "It's 6 months after launch and nobody uses it. What went wrong?" | Gary Klein's pre-mortem | Medium: surfaces real risks fast | Very low |
| 10 | **Automated persona evals** via `claude -p` across all test projects | agentskills.io evals, our persona files | High for quality over time | Medium |
| 11 | **Analytics events** for the success metrics: which events prove each success criterion | our success-criteria section | Medium | Low |
| 12 | **Time and cost estimate** shown at intake ("about 20 questions, about 45 minutes") | BMAD's size-based tracks | Low to medium | Very low |

**Not recommended now:**
- A full technical design document (Phase 2 backlog).
- Merged `CURRENT.md` specs (OpenSpec shows the merge risk).
- Ticket or task output (you ruled it out).
- Fine-tuning or RL on designer feedback (research-grade only).

---

## Decisions for the discussion

1. **Question UX:** one picker call per round with 1–3 questions, or strictly one question per call?
2. **Explain** as a visible 4th option, leaving 3 real answers? Or Explain via Other, leaving 4 real answers?
3. **Technical round:** an opt-in short round of 5–8 questions after the product gate, with technical answers kept out of the FRs?
4. **Coverage map** replacing "predict the next 3 answers" as the stop test?
5. **Phases:** a full spec per phase plus `map.md` now, and deltas in Phase 2 of the roadmap?
6. **Modules:** the module × phase map for L ideas, with module-prefixed IDs when split?
7. **Which of the ranked ideas go into the next build?** My pick: 1, 2, 3, 4, 5 and 9, which are all low effort.
8. **Testing:** add `06-mixed` and automate persona runs, before or after the next build?
