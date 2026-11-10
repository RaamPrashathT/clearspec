# Interview method for `/spec-it`

Status: design draft · 2026-11-03. This becomes `references/interview.md` at build time, condensed.

## Why we write our own

`/spec-it` can't reliably call the source skills:

- `grill-me` and all pstack skills are user-invoked.
- `interview-me` and `spec-driven-development` end the turn when they finish.
- Pocock's own docs record that naming another skill "does not reliably cause that skill to load".

So the method lives in our own text, in our own words. Credits and MIT notices go at the bottom of the reference file.

## What we take from each source

| # | Technique | From | Why it earns a place |
|---|---|---|---|
| 1 | **Hypothesis + confidence %** at intake, with what's missing when under 70% | Osmani `interview-me` | Makes the agent commit to a reading the developer can correct. The % gives a visible progress signal. |
| 2 | **Design tree + frontier.** Only ask decisions whose prerequisites are settled | Pocock `grilling` | Never asks a question that a pending answer would change. Later questions are ones the first round couldn't have asked. |
| 3 | **Facts are ours, decisions are theirs.** Facts are looked up by a subagent, never asked | Pocock `grilling` | The single biggest saver of question budget. |
| 4 | **Recommendation on every question**, worded so "yes" accepts it | Both (GUESS / ➡️) | Reacting is faster than generating an answer, and it exposes the agent's assumptions. |
| 5 | **Contrarian guess now and then** | Osmani | Counters a polite developer who just agrees. |
| 6 | **"Want vs. should want" probe** when an answer is buzzwords ("scalable", "clean", "modern") | Osmani | Gets past convention to the real requirement. |
| 7 | **Concrete edge-case scenarios** ("Ana edits the order while Raj cancels it: who wins?") | Pocock `domain-modeling` | Edge cases surface faster as stories than as abstract questions. |
| 8 | **Sharpen fuzzy terms.** "account": Customer or User? Each resolved term is added to a glossary | Pocock `domain-modeling` | Keeps the spec's vocabulary consistent. Becomes a Glossary section in `REQUIREMENTS.md`. |
| 9 | **Restate vague goals as testable criteria** ("fast" becomes "list renders under 1 s with 10k rows") | Osmani `spec-driven-development` | The spec's acceptance criteria come straight from these. |
| 10 | **Delegation is not an answer.** "Whatever you think" gets 2 concrete options once, then is logged as an assumption | Osmani | Stops silent assumptions from posing as decisions. |
| 11 | **Restate gate.** A 6-line restate (Outcome, User, Why now, Success, Constraint, Out of scope) needs an explicit yes | Osmani | Pocock's docs note models skip this gate, so we make it a hard step. |
| 12 | **Stop test:** "Can I predict the next 3 answers?" | Osmani | A checkable bound instead of a vibe. |
| 13 | **Reopen on contradiction.** A later answer that changes an earlier one reopens that branch | Pocock (frontier limit) | The frontier is chosen by judgement, so it can be wrong. |
| 14 | **Impact = hard to reverse × surprising × real trade-off** | Pocock ADR test, repurposed | Gives the 15–25 budget a ranking rule. |
| 15 | **Premise check first.** Question whether this is the right thing to build before detailing it | poteto `principle-attack-the-premise`, Osmani | The cheapest moment to kill a wrong idea. |

## The loop

1. **Intake.**
   - A subagent scans the repo for facts: stack, existing UI, domain terms.
   - Write `HYPOTHESIS`, `CONFIDENCE`, `MISSING` and the starting assumptions to `00-intake.md`.
   - Seed the design tree in `01-decisions.md`, one node per open decision, using this format:
     ```
     D7 [open] Who can cancel an order?   depends: D2   lens: roles   impact: H
     ```
2. **Pick the next question(s).**
   - Take the frontier (open nodes whose dependencies are settled).
   - Drop anything a fact lookup can answer, and dispatch that lookup.
   - Rank what's left by impact, then by uncertainty.
3. **Ask.** Use this format:
   ```
   ❓ Q7/~20 · Edge cases · confidence 65%
   **Concurrent edits**: Ana edits order #4182 while Raj cancels it. What should Ana see?
   ➡️ Recommended: the cancel wins and Ana gets a "this order was cancelled" banner. Simpler than merging, and cancels are rare.
   ```
   Plain text by default. Use the `AskUserQuestion` picker only for a pure 2–4 option choice.
4. **Record.**
   - Mark the node `settled`, with the answer and a one-line rationale. A delegated answer becomes `assumed`.
   - Add any new nodes the answer opens.
   - Add resolved terms to the glossary.
   - If the answer contradicts a settled node, reopen it.
   - Update the confidence %.
5. **Repeat** until the budget is spent, the frontier is empty, or the developer says "enough". From question 15 on, also stop once the stop test passes.
6. **Restate gate.** Write the 6-line restate and wait for an explicit yes. Fold corrections back in and restate again.

## Pacing: one question or small rounds

The two sources disagree:

- **Osmani:** one question at a time. Batches invite skimming.
- **Pocock:** a round is the whole frontier, so 13 questions arrive in about 3 rounds. One-at-a-time is a supported opt-out.

**Recommendation: small rounds of up to 3 independent questions, numbered so the developer can answer "1 yes, 2 B, 3 no because…".**
- The first round is always a single premise question, because everything hangs on it.
- Rounds keep a 20-question session to about 8 turns instead of 20.
- The cap of 3 keeps each question read carefully.

This needs your decision, because the current spec (FR-Q2) says one at a time.

## Lens coverage (where the 15–25 go)

| Lens | Questions | Typical probes |
|---|---|---|
| Premise and intent | 2–4 | Who is it for, why now, what happens if we don't build it |
| Users, roles, scope | 3–5 | Permissions matrix, what is explicitly out |
| Core flows and data | 4–6 | Main entities and lifecycle, the happy path end to end |
| Edge cases and failure | 4–6 | Scenarios: empty, concurrent, offline, limits, partial failure, abuse |
| Success and NFRs | 2–4 | Testable criteria, scale, a11y, privacy |

## Red flags (self-check during the run)

- Asking the developer something a file or command could answer.
- Answering a decision yourself instead of asking it.
- Two questions in one round where one depends on the other.
- Accepting "scalable" or "best practice" as an answer without the probe.
- Moving to synthesis without an explicit yes on the restate.
- Confidence not rising after 3 rounds. Stop and say something foundational is missing.

## Common rationalizations

| Excuse | Reality |
|---|---|
| "The idea is clear, skip the interview" | If you can't write the outcome in one sentence, it isn't clear. |
| "I'll fill this gap with a sensible default" | Then it's an assumption: log it and show it in the spec. |
| "We've hit 15, good enough" | 15 is the floor. Stop only when the stop test passes too. |
| "They said sounds good" | That isn't a yes. Ask what they'd refine. |
