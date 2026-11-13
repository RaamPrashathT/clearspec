# Questions

## Contents
- The question gate
- Order: riskiest first
- Product question bank
- Technical question bank (fork points)
- Writing one question
- Probes for weak answers
- Stopping
- Bad vs. good

## The question gate

Before asking, a question must pass all five. If it fails one, do what the right column says.

| Test | If it fails |
|---|---|
| **Not a fact.** The repo, the files, the web, or a standard cannot answer it. | Look it up. |
| **Changes the spec.** Different answers produce a different scope, data model, flow, contract, or Phase 1. | Drop it. |
| **No safe default.** There is no standard answer a reasonable developer would accept without thinking. | Take the default as `A-n`; the confirm gate shows it. |
| **Grounded.** It names a concrete situation with names and numbers, not an abstract area. | Rewrite it as a scenario. |
| **Answerable by this person.** They can know it today (their users, their workflow, their constraints). | Ask what they *do* know, or assume. |

Most "coverage" questions (integrations? notifications? accessibility? i18n?) fail test 2 or 3. Assume them.

## Order: riskiest first

Rank by the cost of being wrong. Ask in roughly this order and skip what the idea or the context step already settled:

1. **Value:** is this the right problem, and is building it the right move? (premise, today's workaround, prior art)
2. **Who and the one job:** primary user, and who is explicitly not a user.
3. **Phase 1 slice and non-goals:** what ships first; what is out.
4. **The domain's hard problems:** the 2–4 the prior-art scan found, each as a scenario.
5. **Rules where people collide:** two actors, one resource.
6. **Technical fork points** (after the switch).

A question that can change the answer to an earlier rank waits until that rank is settled.

## Product question bank

Adapt each to the idea; never ask one verbatim. Each line says what the answer decides.

**Premise and value**
- *Last time:* "Walk me through the last time this went wrong. What happened, and what did you do?" Decides the core job from real behavior, not wishes.
- *Today's workaround:* "Right now you handle this with <the workaround you inferred>. What's the part of that you most want gone?" Decides the must-have.
- *Prior art* (only when the scan found a fit): "<Product A> already does <X>. What makes it not work for you?" Decides the differentiator, or that nothing should be built.
- *Cost of nothing:* "If this never ships, what does it cost you, per week?" Decides priority and a success number.

**People and scope**
- *Primary user:* "Who uses this most, daily? Recommended: <role>, because <reason from context>." Decides whose flow is the happy path.
- *Not a user:* "Should <adjacent role> have any access in Phase 1?" Decides roles and permissions.
- *Phase 1 slice:* "If only one flow worked in week one, which?" with the 2–3 candidate flows. Decides Phase 1.
- *Non-goals, in one question:* a multi-select of the features the standard set includes (from the prior-art scan): "Which of these are out of Phase 1?" One question settles many.

**Domain hard problems** (from the context step: these are your highest-value questions)
- Present each as a scenario with the fixture names: "Ana books Orchid 10:00–11:00 and never shows up. At 10:15, what happens to the room?" Options are the standard answers others use (auto-release after N minutes; nothing; require check-in).

**Collisions and rules**
- "Ana and Raj both edit the 14:00 slot within a second. Who wins, and what does the other one see?"
- "Raj leaves the household owing Ana $40. Can he leave?"

**Pre-mortem** (once, optional, when confidence is low)
- "It's three months after launch and nobody uses it. What's the most likely reason?" Surfaces the riskiest assumption.

## Technical question bank (fork points)

Ask only where the repo and standards leave it open and the answer changes the data model, a contract, or behavior. Each answer goes to §Technical decisions, with the FRs it changes.

| Fork point | Ask when the spec has… | Example |
|---|---|---|
| Ownership and tenancy | data that belongs to a person, team, or org | "Is a room booking owned by the person or by the team? If Ana leaves, do her bookings stay?" |
| Identity | sign-in, roles, or an existing auth in the repo | "The repo uses Clerk. Reuse it, or does this need its own accounts?" |
| Time | dates, deadlines, schedules, "today" | "Ana in London and Ben in New York see the same booking. Whose clock does it show?" |
| Money and quantities | amounts, splits, stock | "$100 split three ways: who gets the extra cent?" |
| Concurrency | two people can change the same thing | "Two people book the last seat. One wins; does the other get an error or a waitlist?" |
| Reuse vs. new | the context step found an overlapping feature | "There's a half-built `notifications` module. Build on it or replace it?" |
| Contracts others depend on | a public API, webhook, CLI flags, file format | "Will other teams script against this? Then `--json` output and exit codes are a contract." |
| Connectivity and sync | mobile, field work, or real-time views | "Raj's phone loses signal mid-checkout. Queue and retry, or block?" |
| Deletion and personal data | data about people beyond a login | "When a member asks to be deleted, do their past expenses stay (anonymized) or go?" |

Never ask: hosting, cloud, CI, monitoring, framework, language, or vendor when the repo fixes it; "how many users" unless a user-facing time or volume target depends on it.

## Writing one question

Context, at most 3 lines, above the picker:
- One line: what you are deciding and what it unblocks ("Decides whether bookings auto-release; changes FR-4 and the room view").
- One or two lines: the concrete scenario with names and values.

The picker:
- **header:** the topic, at most 12 characters.
- **question:** one full sentence that makes sense on its own.
- **options:** 2–4, recommendation first with "(Recommended)" at the end of its label. Each description says what happens if chosen, and where relevant who does it this way ("Outlook and Google Calendar do this").
- "Other" is added by the picker. If the developer asks what something means, answer with one short scenario and ask the same question again.

**Recommendations:** take them from the prior-art scan and the repo, not your taste. About one question in four, recommend the option you expect them to push back on, to check they are reading.

**Batching:** up to 3 questions in one picker call when none depends on another's answer. The first question of a run (the premise) goes alone.

**Recording:** after each answer, add `D-n` to §Decisions: title, answer, provenance (`own` for their words or a non-recommended option, `accepted` for the recommendation, `assumed` for "not sure" or "you pick"), and the FRs it feeds once written.

## Probes for weak answers

- **Buzzword** ("scalable", "flexible like Notion", "best practice"): "If you didn't have to justify it to anyone, what would you want?" with your guess attached.
- **Vague goal** ("fast", "easy"): restate as a number and ask to confirm: "the day view loads in under 1 s with 200 bookings".
- **Overloaded word** ("account", "team", "order"): propose one term with its boundary; add it to the glossary.
- **Delegation** ("whatever you think"): offer two concrete options once. A second delegation becomes `assumed` with an `A-n`.
- **Contradiction** with an earlier decision: say which one, and ask which holds.

## Stopping

Stop asking when any holds:
- You can predict the developer's answers to your next 3 candidate questions.
- Every remaining unknown passes test 1 or has a safe default (test 3).
- The developer says "enough". Remaining unknowns become `A-n`.

If three answers in a row did not raise your confidence, say so: something foundational is missing. Ask the premise again in different words.

## Bad vs. good

| Bad (asked for its own sake) | Why | Good |
|---|---|---|
| "What integrations do you need?" | Abstract; "none" is the usual answer | Assume none (`A-n`). Ask only if the scan found a likely one: "Your team lives in Google Calendar. Should bookings appear there?" |
| "Should start times snap to 15 minutes?" | Standard default exists | `A-3: 15-minute steps` |
| "Who can cancel a booking?" | Obvious default (the booker and the admin) | Assume it; ask instead about no-shows, which the scan flagged |
| "How will you measure success?" | Hard to answer cold | Derive a number from "cost of nothing" and confirm it in the restate |
| "What are your performance requirements?" | Not answerable by most people | "The day view with 6 rooms and 200 bookings opens in under 1 s" as `A-n` |
| "Do you want notifications?" | Yes/no with no stakes shown | "Raj's long booking is declined at 16:00 for tomorrow 09:00. How does he find out before he walks to the room?" |
