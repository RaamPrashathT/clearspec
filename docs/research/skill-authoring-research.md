# Skill authoring research

Researched 2026-11-03. This file covers the official standards and how three well-known authors (Matt Pocock, Addy Osmani, poteto) write their skills. It closes with what this means for `/spec-it`.

## 1. Sources read

| Source | What it is |
|---|---|
| [Anthropic: Skill authoring best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices) | Official authoring guide |
| [Claude Code: Skills](https://code.claude.com/docs/en/skills) | Claude Code frontmatter, loading, compaction, troubleshooting |
| [agentskills.io specification](https://agentskills.io/specification) | Open cross-agent standard |
| [agentskills.io best practices](https://agentskills.io/skill-creation/best-practices.md), [descriptions](https://agentskills.io/skill-creation/optimizing-descriptions.md), [evals](https://agentskills.io/skill-creation/evaluating-skills) | Open-standard authoring, trigger tuning, eval loop |
| [anthropics/skills `skill-creator`](https://github.com/anthropics/skills/tree/main/skills/skill-creator) | Anthropic's skill for building and testing skills |
| [mattpocock/skills](https://github.com/mattpocock/skills) (MIT) | `grilling`, `grill-me`, `writing-for-agents`, `to-spec`, `prototype`, repo rules |
| [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) (MIT) | `docs/skill-anatomy.md`, `interview-me`, `spec-driven-development`, `frontend-ui-engineering`, evals |
| [cursor/plugins/pstack](https://github.com/cursor/plugins/tree/main/pstack) (MIT, © 2026 Lauren Tan) | poteto's skills, the authoring playbook, `docs/harness/claude-code.md` |

## 2. Hard limits (the standard)

| Item | Limit | Source |
|---|---|---|
| `name` | 1–64 chars, `a-z0-9-` only, no leading, trailing or double hyphen, must match folder name; no `anthropic` or `claude` | agentskills spec, Anthropic |
| `description` | 1–1024 chars, no XML tags | agentskills spec, Anthropic |
| Claude Code listing | `description` + `when_to_use` cut at **1,536 chars**; the whole listing shares a budget of about 1% of the context window | Claude Code |
| Startup cost | about 100 tokens per skill (name + description only) | agentskills spec |
| `SKILL.md` body | **under 500 lines and about 5,000 tokens** | agentskills spec, Anthropic |
| After compaction | Claude Code keeps only the **first 5,000 tokens** of each invoked skill (25k total), so important rules go at the top | Claude Code |
| References | **One level deep** from `SKILL.md`. Files over 100 lines get a table of contents | Anthropic |
| Portable frontmatter | `name`, `description`, `license`, `compatibility`, `metadata`, `allowed-tools`. Claude.ai and the API hard-fail on other keys; Claude Code accepts extras (`disable-model-invocation`, `argument-hint`, `context`, `model`, ...) | Claude Code |
| Paths | Forward slashes only. Use `${CLAUDE_SKILL_DIR}` for bundled files | Anthropic, Claude Code |

## 3. Rules everyone agrees on

1. **Add only what the model lacks.** Ask "would the agent get this wrong without this line?" If not, delete it. Every loaded line costs tokens on every turn after it loads.
2. **The description triggers the skill.** It says what the skill does and when to use it, using the words users actually type. Put the key use case first. Keep the workflow out of it: if the description summarises the steps, the agent follows the summary and skips the body (Osmani).
3. **Use progressive disclosure.** `SKILL.md` holds what every run needs. Material that only some runs need goes in a separate file behind a pointer that says *when* to read it ("Read `references/x.md` if ...", not "see references/").
4. **Match freedom to fragility.** Exact commands for fragile steps, heuristics for judgment calls. Calibrate each section on its own.
5. **Give defaults, not menus.** Pick one approach and mention one fallback.
6. **Teach procedures, not one-off answers.** Steps should generalise across inputs.
7. **Keep terminology consistent.** One term per concept, used everywhere.
8. **Every step ends on a checkable completion criterion.** Close with an exit checklist that needs evidence.
9. **Use templates for output formats.** Models copy a concrete structure better than they follow a prose description.
10. **Add validation loops.** Do the work, check it against a script or checklist, fix, and repeat. Use plan → validate → execute for batch or destructive work.
11. **Use scripts for deterministic work.** Only the script's output costs context, and a script is more reliable than code the model writes fresh each run.
12. **Keep gotchas in `SKILL.md`.** Non-obvious, environment-specific corrections are the highest-value content, and they belong where the agent reads them before it hits the problem.
13. **Write evals before polishing.** Compare runs with and without the skill, then iterate (details in §6).

## 4. How each author writes skills

| | **Matt Pocock** | **Addy Osmani** | **poteto (Lauren Tan)** |
|---|---|---|---|
| Typical size | Tiny to medium. `grill-me` is 3 lines; `grilling` is about 25 | Large (10–15 KB), fully sectioned | Very short. Principles are about 15 lines; `sharpen` is 10 |
| Structure | Free prose built on a few strong **leading words** (*design tree*, *frontier*, *rounds*) | Fixed anatomy: Overview → When to Use / NOT → Process → Techniques → **Common Rationalizations** → **Red Flags** → **Verification** | `**Why:**` / `**Pattern:**` / `**Stop:**` blocks; playbooks for workflows |
| Description | Model-facing triggers for model-invoked skills; a one-line human summary for user-invoked ones | Third person: "Does X. Use when ...", with several triggers | One crisp line, often "Use for /name" |
| Invocation | Deliberate split. `grill-me` is user-invoked and only calls `grilling`, which is model-invoked | All model-invoked | Almost all `disable-model-invocation: true` |
| Skill-to-skill calls | Spelled out: `Call the Skill tool with "grilling"`. One skill per call. A user-invoked skill can't be called by another skill | By name in prose ("Follow the `x` skill") | Links by path. In Claude Code, *"The Skill tool refuses most pstack skills"*, so the guide says to `Read` their `SKILL.md` |
| Signature ideas | *Context pointers*, *context load vs cognitive load*, *information hierarchy*, *leading words*, prompt the positive instead of using negation, hunt **no-ops**, avoid *sediment* | **Anti-rationalization tables**, red flags, evidence-based verification, model-neutral procedures, 3-tier evals | "When in doubt, delete." "Keep only prose that changes a decision." Point at structural sources, don't restate them. Blind evals |
| Tooling | Plugin manifest, `claude plugin validate --strict`, docs page per skill | `validate-skills.js` lint, TF-IDF trigger collision check, behavioural evals via `claude -p` | `create-skill`, eval playbook with blind candidates, `/reflect` and `/correct` loops |

### Matt Pocock's style
- **Strong words over long text.** One pretrained concept the model already knows (*relentless*, *tight*, *red*) replaces a sentence. If a word is too weak to beat the default behaviour, swap in a stronger word rather than adding a paragraph.
- **Separate steps from reference.** Inline what every branch needs; move behind a pointer what only some branches reach.
- **Completion criteria need clarity and demand.** A vague bound like "understanding reached" lets the agent stop early. "Every X accounted for" makes it do the legwork.
- **No caps on questions and no `AskUserQuestion`.** He explicitly rejects both (`.out-of-scope/question-limits.md`, `native-question-tool.md`). He wants open questions in plain text, with the user's own "wrap up" as the stop control.
- **`grilling` asks in rounds.** It asks every question that is currently unblocked as one numbered batch, each with a recommended answer worded so "yes" accepts it. It has subagents look up facts; only decisions go to the user.

### Addy Osmani's style
- **The rationalizations table is his distinctive move.** It lists the excuses an agent gives for skipping a step, each paired with a rebuttal.
- **Hard gates.** `interview-me` and `spec-driven-development` both end with *"STOP YOUR TURN IMMEDIATELY"* after their output.
- **Model-neutral writing.** If a step can only be justified by naming a model or one tool's private name, it doesn't belong in the skill.
- **Shared checklists** live in the repo-root `references/`, which breaks per-skill installs (his issue #361).
- **`interview-me`:** one question at a time, each with a GUESS attached and a confidence number. It ends with a 6-line restate (Outcome, User, Why now, Success, Constraint, Out of scope) and an explicit "yes" gate. The stop test is: "Can I predict the user's reaction to the next three questions?"
- **`frontend-ui-engineering`** has an "avoid the AI aesthetic" table: no purple gradients, no rounded-2xl everywhere, no stock card grids, no lorem ipsum.

### poteto's style
- **When in doubt, delete.** "Tell it to do the thing and skip the reason." Explain only when a rule is confusing without its reason.
- **Delegate to other skills by path and don't restate them.** Point at types, READMEs and config rather than copying them.
- **Evals are blind.** Candidates never see the words "eval" or "candidate". A judge grades each output under a neutral label. Whether an agent followed a chain of references is graded from the files it actually read.
- **`unslop` and `technical-writing`** set the writing standard: no em dashes, no AI vocabulary, active voice, one idea per sentence, no over-compressed fragments.

## 5. Where the sources disagree, and what we choose

| Topic | Positions | Our choice |
|---|---|---|
| Description voice | Anthropic: third person. agentskills.io: imperative "Use this skill when...". Anthropic's `skill-creator`: a little pushy | Third person for *what*, then "Use when ..." for *when*. Mildly pushy. |
| Explain why vs. just command | Anthropic and `skill-creator`: explain the why and avoid all-caps MUSTs. poteto: skip the reason unless the rule confuses without it | Give the reason in one clause, only for rules that look arbitrary. No all-caps. |
| Long and sectioned vs. tiny | Osmani: full anatomy. Pocock and poteto: minimal | Short `SKILL.md` with steps and gotchas; detail moves to `references/`. Borrow Osmani's Rationalizations and Verification sections, kept short. |
| Question cap | Pocock: never cap. Our user: 15–25 | We cap, because the user decided. Pocock's point still applies: the fix for low-value questions is better ranking, not just a counter. |
| `AskUserQuestion` | Pocock: plain text only. pstack harness doc: maps to `AskUserQuestion` | Plain text by default (open answers). `AskUserQuestion` only for 2–4 option choices. |

## 6. The eval workflow (agentskills.io and `skill-creator`)

- **Behaviour evals:** `evals/evals.json` with `{id, prompt, expected_output, files, assertions[]}`. Start with 2–3 realistic cases. Run each **with and without** the skill in clean subagents and record `total_tokens` and `duration_ms`. Grade each assertion PASS or FAIL with quoted evidence, then aggregate into `benchmark.json` (pass-rate delta against token and time cost).
- **Assertions:** add them after the first run. Make them verifiable ("valid JSON", "exactly 3 months"). Drop assertions that pass in both arms. Judge subjective quality, such as visual design, by human review.
- **Trigger evals:** about 20 queries (8–10 should trigger, 8–10 should not, mostly **near-misses**), run 3× each, 60/40 train/validation split, about 5 iterations. Pick the description with the best validation score.
- **Tools:** Anthropic's `skill-creator` automates all of the above. Claude Code also offers `claude plugin validate`, `claude plugin eval`, `/skill-doctor` and `--debug`.

## 7. What this means for `/spec-it`

These findings change parts of the design in `REQUIREMENTS.md`:

1. **`grill-me` can't be called by our skill.** It is user-invoked (`disable-model-invocation: true`). Call the model-invoked **`grilling`** skill instead: `Call the Skill tool with "grilling"`.
2. **pstack skills can't be called through the Skill tool either.** They are user-invoked and Cursor-named. If a pstack skill is installed, `Read` its `SKILL.md`; otherwise use our own lens.
3. **Osmani's `interview-me` and `spec-driven-development` would end our pipeline.** Both end with "STOP YOUR TURN IMMEDIATELY". Use them as question lenses (borrow the hypothesis + confidence and restate patterns in our own words), not as skills that take over the turn.
4. **`grilling` doesn't fit our cap as-is.** It asks in batched rounds and has no cap; our requirement is one question at a time, 15–25 in total. Our orchestrator keeps control of pacing. We borrow its ideas: the design-tree frontier, a recommended answer worded so "yes" accepts it, and subagents for looking up facts.
5. **Make `/spec-it` user-invoked** (`disable-model-invocation: true`). It is a long, heavy workflow a person starts on purpose, so it should cost no listing context. Its description is then a one-line human summary.
6. **Front-load the rules that matter.** After compaction only the first 5k tokens survive, so the question budget, the "facts are my job, decisions are the user's" rule, the output paths and the gotchas go at the top of `SKILL.md`. Phase detail goes to `references/` (`interview.md`, `screens.md`, `requirements-template.md`), each read at the start of its own phase.
7. **Move deterministic checks into scripts.** For example, `scripts/check-trace.*` checks that every FR ID on a screen exists in the spec and that every Must FR has a screen. That is cheaper and more reliable than asking the model to re-read everything.
8. **Screen quality.** Fold in Osmani's anti-AI-aesthetic table and the WCAG checks from `frontend-ui-engineering`. Pocock's `prototype` adds: when the repo has an existing app, mock against its real layout and design system.
9. **Evals before polish.** Write 3 behaviour cases (one-line idea, idea inside an existing repo, contradictory idea) with assertions such as "15–25 questions", "no duplicate questions", "every FR has acceptance criteria", "screens open from `file://`". Judge visual quality by human review.
10. **Writing standard.** No em dashes, plain words, active voice, a positive phrasing for each rule, no restating of other skills, and a no-op hunt before shipping.
