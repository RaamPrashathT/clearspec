# Interview method

## Contents
- decisions.md (file format the check script reads)
- Discovery
- Sizing
- Coverage areas
- The loop
- Asking one question (picker and text formats)
- Explain flow
- Presenting
- Probes
- Provenance and the 70% check
- Product gate and restate
- Technical round
- Red flags
- Credits

## decisions.md

One file per unit, written from intake on. Keep the markers exact.

```
# Decisions: <working title>
Unit: 1-habit-tracker · Type: UI · Size: M · Budget: 15-25 · Technical budget: 0-8 (sensitive points only)

## Intake
HYPOTHESIS: <one sentence: what the developer wants and why>
CONFIDENCE: 35% (missing: <what is unresolved>)
Repo facts:
- <fact from the subagent summary>
Inputs read:
- <attached files>

## Coverage
| Area | Status | Decisions |
|---|---|---|
| Scope and roles | Partial | D-1 |
| Data and lifecycle | Missing | |
| Flows and states | Missing | |
| Quality needs | Missing | |
| Integrations | Missing | |
| Edge cases | Missing | |
| Terminology | Missing | |
| Success measures | Missing | |

## Tree
- D-1 [settled] Core job · own · Q1
  Answer: Running balances plus settle-up.
  Why: The pain is history, not calculation.
- D-2 [open] Joining model · depends: D-1 · area: scope · impact: H
- D-4 [fact] Stack · fact
  Answer: React 19, Tailwind 4 (from repo scan).
- D-9 [assumed] Notifications · assumed · Q11 · A-1
- D-12 [settled] Shape · own · C1
- D-15 [settled] Time storage · own · T1

## Glossary
- Household: the group that shares a ledger. Not "group" or "team".

## Restate
- Outcome: …
- User: …
- Why now: …
- Success: …
- Constraint: …
- Out of scope: …

Confirmed: yes
```

- Before sizing, write `Budget: pending`; set it after discovery.
- Node states: `open`, `settled`, `assumed`, `fact`. Provenance: `own` (the developer's answer, an alternative, or typed text), `accepted` (took the recommendation), `assumed` (delegated, skipped, or "not sure"; gets an `A-n`), `fact` (looked up, never asked).
- Question tags: `Qn` counts toward the budget. `Tn` technical round. `Xn` contradiction check. `Cn` checkpoint (shape, phases, build mode, technical-round offer, continue to next unit). Explains get no tag.
- Coverage status: `Clear`, `Partial`, `Missing`, or `Assumed` (covered by an `A-n`). Update the table after every answer.

## Discovery

Ask only what the request leaves open. A PRD or a detailed brief may answer all of it, and then the phase is skipped. Discovery questions are `Qn` and count toward the budget.

1. **Premise:** What is driving this today, and what happens if nothing is built?
2. **People:** Who uses it? (multi-select of likely roles, plus Other)
3. **Areas:** Which of these do you actually need? (multi-select of the usual areas for this kind of product, plus Other)
4. **Standard or custom:** an industry-standard feature set (like an off-the-shelf product) or built around your own workflow? If standard, ask once whether an existing product was ruled out, and record the reason.
Never decide structure here. The answers feed the shape signals in `references/structure.md`.

## Sizing

Set after discovery, per unit:

| Size | Signals | Budget |
|---|---|---|
| S | One main flow, 1–2 roles, a handful of entities | 8–12 |
| M | Several flows or roles, a real data lifecycle | 15–25 |
| One large unit | The developer kept a large scope as one spec at the shape checkpoint | up to 40 |

Tell the developer the size and budget in one line; one word from them overrides it.

## Coverage areas

| Area | What Clear means |
|---|---|
| Scope and roles | who uses it, what each role can and cannot do, what is out of scope |
| Data and lifecycle | main entities, how each is created, changed, deleted, and retained |
| Flows and states | the happy path end to end, plus empty, loading, error, and permission states |
| Quality needs | testable targets for performance, privacy, accessibility, i18n |
| Integrations | external systems, imports and exports, and what happens when they fail |
| Edge cases | concurrency, limits, partial failure, abuse, time and timezone cases |
| Terminology | each overloaded word has one canonical term in the glossary |
| Success measures | at least one number that tells whether the product works. Never asked as its own question: the restate's Success line carries a number, logged as an `A-n` assumption, and the restate's yes confirms it |

API products: flows and data include the resource model, auth, pagination, idempotency, and the error contract. CLI products: command shape, flags, config precedence, output formats, exit codes, interactivity, and how destructive each command is (see `references/api-cli.md`).

## The loop

1. **Frontier.** Open decisions whose `depends:` are all settled, assumed, or fact.
2. **Facts out.** Anything the environment can answer goes to a fact lookup, marked `fact` when it returns. Only decisions that depend on a pending fact wait for it.
3. **Pick one question:** from the frontier, the one in a `Missing` or `Partial` coverage area with the highest impact, where impact means hard to reverse, surprising to a future reader, and a real trade-off. A question with none of the three becomes an `A-n` assumption instead. Success measures are never picked: they are assumed and confirmed through the restate.
4. **Ask it** (format below) and wait.
5. **Record:** state, provenance, answer, one-line why; add the decisions the answer opens; add resolved terms to the glossary; update the coverage table and the confidence %. If an answer contradicts a settled decision, reopen it and ask it next as `X<n>`.
6. **Repeat** until the product gate passes, the budget's upper bound is reached, or the developer says "enough". Coverage areas still open at that point become `A-n` assumptions with the recommended default.

## Asking one question

Write a short context block, then ask with one picker call. The context block holds:
- a progress line: `Q8 of ~20 · Edge cases · Confidence 65% · Recorded: Q7 accepted (any member edits shared habits)`
- one or two lines of concrete context with names and values from the future fixtures
- `Why it matters:` one line naming the decision it unblocks or the risk it removes

The picker call (in Claude Code, `AskUserQuestion`) holds one question:
- **header:** the coverage area, at most 12 characters
- **question:** one full interrogative sentence that makes sense on its own
- **options**, in this order, each a label of 1–5 words plus a one-line description of what happens:
  1. the recommended answer, label ending in "(Recommended)"
  2. an alternative (optional)
  3. a second alternative (optional)
  4. "Explain with an example": "A short story showing what each option means"
- The picker adds "Other" for a typed answer.
- For open questions (no discrete choices): option 1 is the suggested answer, option 2 is "Not sure yet" (logged as an assumption), then "Explain with an example".
- Design-direction question: put an ASCII sketch of each layout in its option's preview.

About one question in four, make the recommendation one you expect the developer to push back on: it tests whether they are reading or nodding.

**No picker available** (another editor, `claude -p`): same content as text, then wait:

```
Q8 of ~20 · Edge cases · Confidence 65% · Recorded: Q7 accepted

Ana pays $100.00 for groceries, split three ways. Three shares of $33.33 add up to $99.99.
Why it matters: decides whether every balance adds up to the cent.

**Who absorbs the extra cent?**
1. **The payer** (recommended): Ana's share becomes $33.34.
2. **Rotates**: the next person in turn takes it.
3. **Nobody**: the expense is stored as $99.99.
4. **Explain with an example**

Reply with a number, or type your own answer.
```

## Explain flow

1. The developer picks "Explain with an example" (or replies `4` or "explain").
2. Reply in plain words: a short story with the fixture names, what each option would mean in practice, and why the decision matters. End the message there, with no question.
3. Ask one picker question: "Did that make sense?" with "Yes, ask me the question again" (recommended) and "Explain it differently"; Other stays available.
4. On "yes", ask the same question again with the same number. On "differently", explain once more with a different example, then step 3 again.

Explains never count toward the budget.

## Presenting

- **Show each question exactly once.** It is the last thing in your message. Do not restate it in a recap, a summary, a closing message, or any end-of-turn question box or buttons the host app provides. If the host app asks for an end-of-turn recap, give one line ("Q8 is waiting for your answer") and no question.
- **Background results don't reopen a question.** When a fact lookup returns while a question is open, record it and say at most one line about it. Repeat the question only if the new fact changes it, and say what changed.

## Probes

- **Want vs. should want.** When an answer is a convention or a buzzword ("flexible like Splitwise", "scalable", "modern", "best practice"), ask: "If you didn't have to justify this to anyone, what would you actually want?" and attach your guess.
- **Vague to testable.** Restate a vague goal as a measurable criterion and ask for confirmation: "fast" becomes "the balance list renders in under 1 s with 500 expenses".
- **Sharpen terms.** When a word is overloaded ("account", "team", "order"), propose one canonical term and its boundary, then add it to the glossary.
- **Delegation.** "Whatever you think" gets two concrete options once. A second delegation is logged as `assumed` with the recommended answer and an `A-n`.

## Provenance and the 70% check

Before the restate, count provenance over `Q` questions. If `accepted` exceeds 70%, list the accepted decisions, one line each, and ask: "You accepted most of my recommendations. Some may be my defaults, not your decisions. Any you'd change?" Changed ones become `own`. Recommended defaults make people check less, so this check stays even when the run went smoothly.

## Product gate and restate

The product side is done when every coverage area is `Clear` or `Assumed`. Then write the restate (Outcome, User, Why now, Success, Constraint, Out of scope), using the developer's own words where possible, and ask with a picker: "Is this right?" with "Yes" (recommended), "Refine it", and Other. Fold corrections in and restate again. On an explicit yes, append `Confirmed: yes` under `## Restate`. Out of scope is required: half of misalignment is silent disagreement about what is not being built.

## Technical round

The technical round settles the few technical choices that change what the spec says. It is not an infrastructure checklist. Most specs need 0 to 4 questions.

**Find the sensitive points first.** Scan the restate, the constraints and the FRs against this table. Each match gives at most one question. No match means no question.

| Sensitive point | Triggers when the spec has… | Ask how… |
|---|---|---|
| Time and time zones | any date, time, deadline, schedule, or "past" or "today" rule | times are stored and shown |
| Concurrent changes | two people can change the same slot, balance, seat or count at once | a collision is resolved |
| Identity and access | sign-in, roles, or "only X can see or change Y" | people sign in, and who is let in |
| Personal data | data about people beyond a login (contact details, location, health, money) | that data is stored, shared and deleted on request |
| Money and quantities | amounts paid, split, counted or reserved | rounding and currency work |
| Approval and audit | someone must approve, or a history must be trusted | changes are recorded, and who sees the record |
| Connectivity | phone use on weak signal, or work that must continue offline | a dropped connection looks to the user |
| Outside systems | the app reads or writes another system | that system's failure is handled |

**Do not ask about:**
- Hosting, cloud provider, deployment, CI, monitoring or backups. The coding agent decides these later. The exception is where personal data may be stored, which belongs under Personal data.
- Frameworks, libraries, languages or vendors. Repo facts are never asked. A database is asked about only when a sensitive point needs a feature some databases lack, such as timezone-aware timestamps.
- Data retention, unless personal data is involved.
- Scale or performance numbers, unless the spec states a user-facing time target or a volume. Then ask for that number, not for "scale".

**Asking:**
- Offer the round once, as checkpoint `C<n>`: "The product spec is ready. Add a short technical round on the sensitive points?" Options: **Short technical round** *(recommended when a sensitive point matched)*, **Skip** (listed under Open questions for the coding agent), **Explain with an example**. If no sensitive point matched, do not offer it. Record "Technical round: none, no sensitive points" in `decisions.md`.
- One question at a time, same format, tagged `Tn`. At most 8 is a ceiling, not a target.
- Each `Tn` question names what it changes: `Changes: FR-3, EC-5`. If you cannot name one, do not ask it.
- Use concrete names and values from the fixtures in the context block.
- Answers go to `REQUIREMENTS.md` §11. FRs stay technology-agnostic: the FR says what the user sees, and §11 says how it is achieved.
- An answer that contradicts a settled product decision reopens it as an `X<n>` contradiction check.

**Example, time and time zones:**

```
Ana in London books 09:00–10:00 on Tuesday. Ben in New York opens the same room's calendar.
Changes: FR-3 (booking display), EC-5 (bookings that cross midnight).
Why it matters: decides what Ben sees, and whether a booking across midnight is one record or two.

**How should a booking's time be stored and shown?**
1. **Store UTC, show each viewer's zone** (recommended): Ben sees 04:00 and 09:00 in London.
2. **Store and show the office zone**: everyone sees London time.
3. **Store UTC, show the office zone**: a fixed zone for display, UTC underneath.
4. **Explain with an example**
```

## Red flags

- Asking the developer something a file or command could answer.
- Answering a decision yourself instead of putting it to the developer.
- Proposing modules or phases before the shape signals hold.
- Accepting a buzzword answer without the want-vs-should probe.
- Asking a technical question that no FR or EC depends on (hosting, deployment, vendor choice).
- Asking how the app will be judged after launch ("how will you know it's working?"). That is the restate's Success line, not a question.
- Moving to synthesis before `Confirmed: yes` is on disk.

## Credits

Techniques adapted, in our own words, from MIT-licensed work: Matt Pocock's `grilling` and `domain-modeling` (design tree, frontier, facts vs decisions, scenario probing, glossary; github.com/mattpocock/skills), Addy Osmani's `interview-me` and `spec-driven-development` (hypothesis and confidence, guess per question, want vs. should want, restate gate, testable criteria; github.com/addyosmani/agent-skills), Lauren Tan's pstack `principle-attack-the-premise` (premise first; github.com/cursor/plugins/tree/main/pstack), and GitHub spec-kit's `clarify` (coverage taxonomy, one question at a time with a recommended option; github.com/github/spec-kit).
