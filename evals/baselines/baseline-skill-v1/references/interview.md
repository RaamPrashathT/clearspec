# Interview method

## Contents
- Sizing
- File formats (`00-intake.md`, `01-decisions.md`)
- The loop
- Question format
- Presenting a round
- Probes
- Provenance and the 70% check
- Stop test and restate gate
- Lens coverage
- Red flags
- Credits

## Sizing

| Size | Signals | Budget |
|---|---|---|
| S | One main flow, 1–2 roles, a handful of entities | 8–12 |
| M | Several flows or roles, a real data lifecycle | 15–25 |
| L | Several independently testable capabilities (accounts + billing + reporting) | Scope check first; one spec continues up to 40 |

Rank questions by impact: hard to reverse, surprising to a future reader, and a real trade-off. A question with none of the three is a candidate for an `A-n` assumption instead.

## File formats

The check script parses these lines, so keep the markers exact.

`00-intake.md`:
```
# Intake: <working title>
Type: UI | API | CLI | mixed (UI+API)
Size: S | M | L
Budget: 15-25
HYPOTHESIS: <one sentence: what the developer wants and why>
CONFIDENCE: 35% (missing: <what is unresolved>)

## Assumptions
- <starting assumption>

## Repo facts
- <fact from the subagent summary>

## Inputs
- <attached files read>
```

`01-decisions.md`:
```
# Decisions: <working title>
Budget: 15-25

## Tree
- D-1 [settled] Core job · own · Q1
  Answer: Running balances plus settle-up.
  Why: The pain is history, not calculation.
- D-2 [open] Joining model · depends: D-1 · lens: roles · impact: H
- D-4 [fact] Stack · fact
  Answer: Next.js 15, Prisma, SQLite (from repo scan).
- D-9 [assumed] Notifications · assumed · Q11 · A-1

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

Node states: `open`, `settled`, `assumed`, `fact`. Provenance: `own` (developer's own answer), `accepted` (took the recommendation), `assumed` (delegated or skipped, gets an `A-n`), `fact` (looked up, never asked). Each asked question carries its `Qn`; contradiction checks carry `X1`–`X3` and do not count toward the budget.

## The loop

1. **Frontier.** Take the open nodes whose `depends:` nodes are all settled, assumed, or fact.
2. **Facts out.** For any frontier node the environment can answer, dispatch a fresh-context subagent and mark it `fact` when it returns. Ask the remaining questions without waiting for it; only nodes that depend on the pending fact wait.
3. **Rank** the frontier by impact, then uncertainty. Take up to 3 that do not depend on each other.
4. **Ask** the round (format below). Wait for the answers.
5. **Record.** Mark each node `settled` or `assumed` with provenance, answer, and a one-line why. Add the nodes each answer opens. Add resolved terms to the glossary. If an answer contradicts a settled node, reopen that node and ask it next as `X<n>`. Update the confidence %.
6. **Repeat** until the stop condition holds.

Round 1 is always one question: the premise. It asks whether this is the right thing to build and what the core job is, because every other decision hangs on it.

## Question format

Write every round in this shape. No emoji, no decorative symbols.

```
### Round 4 of ~8 · Edge cases
Questions 8–10 of ~20 · Confidence 65% · Recorded so far: Q1–Q7

---

**Q8. The lost cent**
Ana pays $100.00 for groceries, split three ways. Three shares of $33.33 add up to $99.99.
Who absorbs the extra cent?

- **A. The payer** *(recommended)*: Ana's share becomes $33.34.
- **B. Rotates**: the next person in turn takes it.
- **C. Nobody**: the expense is stored as $99.99.

*Why it matters:* decides whether every balance adds up to the cent.

---

**Q9. …**

---

**How to reply:** `yes` accepts every recommendation in this round. Or answer by number: `8 B, 9 yes, 10 no, because …`. Ask `explain 9` for a fuller example.
```

- **Context first, question second.** One or two lines of concrete context, using names and values from the future fixtures, then the question on its own line. The developer should never need to ask what a question means.
- **Options when the choice is discrete:** 2–4 lettered options, one line each, saying what happens. Mark exactly one *(recommended)* and give the reason in the same line. For open questions, replace the options with one line: `**Recommended:** … because …`.
- **Why it matters:** one line naming the decision it unblocks or the risk it removes.
- **Recorded line:** start the round with what the last answers settled, one line per question (`Q6 accepted: any member edits shared habits.`), above the round header.
- About one round in four, make the recommendation one you expect the developer to push back on. It tests whether they are reading or nodding.
- **`explain N`:** answer with a 2–3 line story and the reason the decision matters, then repeat only question N with its options. Its number stays the same, and it is not a new question.
- A structured picker (such as `AskUserQuestion`) is fine for a single 2–4 option question; then the picker is the only place that question appears.

## Presenting a round

- **Show each round exactly once.** It is the last thing in your message. Do not restate it in a recap, a summary, a closing message, or any end-of-turn question box or buttons the host app provides. If the host app asks for an end-of-turn recap, give one line ("Round 4 is waiting for your answers") and no question.
- **Background results don't reopen a round.** When a fact lookup returns while a round is open, record it in `01-decisions.md` and say at most one line about it. Repeat a question only if the new fact changes it, and say what changed.
- **One reply, one round.** After recording the answers, the next message carries the next round and nothing that repeats the previous one.

## Probes

- **Want vs. should want.** When an answer is a convention or a buzzword ("flexible like Splitwise", "scalable", "modern", "best practice"), ask: "If you didn't have to justify this to anyone, what would you actually want?" and attach your guess.
- **Vague to testable.** Restate a vague goal as a measurable criterion and ask for confirmation: "fast" becomes "the balance list renders in under 1 s with 500 expenses".
- **Sharpen terms.** When a word is overloaded ("account", "team", "order"), propose one canonical term and its boundary, then add it to the glossary.
- **Delegation.** "Whatever you think" gets two concrete options once. A second delegation is logged as `assumed` with the recommended answer and an `A-n`.

## Provenance and the 70% check

Before the restate, count provenance over asked questions. If `accepted` exceeds 70%, list the accepted decisions in one line each and say: "You accepted most of my recommendations. Some may be my defaults, not your decisions. Any you'd change?" Changed ones become `own`.

## Stop test and restate gate

Stop asking when any holds:
- the budget's upper bound is reached;
- the developer says "enough" or similar;
- you are past the budget's lower bound and you can predict the developer's answers to the next 3 questions you would ask.

If you are past the lower bound and confidence has not risen for 3 rounds, say so and ask whether something foundational is missing.

Then write the restate (Outcome, User, Why now, Success, Constraint, Out of scope), using the developer's own words where possible, and ask "Yes / no / refine?". Fold corrections in and restate again. On an explicit yes, append `Confirmed: yes` under `## Restate`. Out of scope is required: half of misalignment is silent disagreement about what is not being built.

## Lens coverage

Spread the budget roughly like this (M sizing; scale for S and L):

| Lens | Share | Typical probes |
|---|---|---|
| Premise and intent | 15% | who it is for, why now, what happens if it is not built |
| Users, roles, scope | 20% | roles and permissions, what is explicitly out |
| Core flows and data | 25% | main entities and lifecycle, happy path end to end |
| Edge cases and failure | 25% | empty, concurrent edits, offline, limits, partial failure, abuse, data deletion |
| Success and NFRs | 15% | testable success criteria, scale, accessibility, privacy, i18n |

For API products, flows and data include the resource model, auth, pagination, idempotency, and the error contract. For CLI products, they include command shape, flags, config precedence, output formats, exit codes, and interactivity.

## Red flags

- Asking the developer something a file or command could answer.
- Answering a decision yourself instead of putting it to the developer.
- Two questions in one round where one depends on the other.
- Accepting a buzzword answer without the want-vs-should probe.
- Moving to synthesis before `Confirmed: yes` is on disk.

## Credits

Techniques adapted, in our own words, from MIT-licensed work: Matt Pocock's `grilling` and `domain-modeling` (design tree, frontier, facts vs decisions, scenario probing, glossary; github.com/mattpocock/skills), Addy Osmani's `interview-me` and `spec-driven-development` (hypothesis and confidence, guess per question, want vs. should want, restate gate, testable criteria; github.com/addyosmani/agent-skills), and Lauren Tan's pstack `principle-attack-the-premise` (premise first; github.com/cursor/plugins/tree/main/pstack).
