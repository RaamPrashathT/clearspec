# UX research: spec-it app

What comparable tools do, what that means for spec-it, and a ranked list of changes. Written 2026-11-10 after the first working build.

## What spec-it's UX has to get right

A spec-it run is **20–40 minutes of interview plus generation**, about $5 per run. The developer's job is to answer well and to review a long document and a set of mockups. So the UX has three jobs, in order:

1. **Make answering fast and well-informed:** questions, context, recommendations.
2. **Make the long waits feel safe:** progress, what it's doing, stop or redirect.
3. **Make the output easy to review and correct:** spec, mockups, traceability, revise.

## What others do (and what to borrow)

| Product | Pattern | Borrow for spec-it |
|---|---|---|
| **Kiro** (spec-driven IDE) | Requirements → design → tasks, with a **review gate per phase**; "Quick spec" skips gates; "Analyze requirements" finds gaps; edits propagate with Refine and Sync | A **phase stepper** (Context → Product Qs → Technical Qs → Confirm → Spec → Mockups → Check) with the current step highlighted; an explicit **Confirm gate card**; a "Quick mode" for small ideas |
| **Zed agent panel** (ACP host) | Model selector with **favorites**; **token counter** by the input; a "files edited, +/- lines" accordion with **Review changes**; ACP model selection through the session config API | Header model switcher (done); a **cost/token meter** with a budget; a **"Files written" list** with diffs between spec versions |
| **Lovable / Bolt** | Chat beside a **live preview**; a **select-element** mode on the preview; **comments as instructions**; batched visual edits sent as one prompt | **Comment on a mockup element or a spec line** → batched into one `--revise` request. The mockups already carry `data-fr` / `data-ec`, so a click resolves to the exact FR and edge case |
| **Claude Code desktop / Cursor** | Plan list pinned under the chat; background work with notifications; stop and steer mid-run | A pinned **plan/progress list**; **desktop notifications** when a question is waiting; "steer" messages while the agent works |
| **Agent UX guidance 2026** (CHI workshop paper, practitioner checklists) | Gate only risky moments; show progress for anything over ~30 s; easy stop and redirect; an inspectable history; bound the scope up front rather than approving every step | Auto-approve inside the project folder (already done); collapse tool noise into **steps**; keep a full **activity log** one click away |

## Ranked improvements

Value is for spec-it specifically. Effort assumes the current plain-JS UI.

### Do next (high value, low effort)

1. **Model dropdown** *(done in this pass)*. Setup offers Opus 5.5 / Sonnet 5.5 / Fable 5.1 / Haiku 5.5 / "My Claude Code default", defaulting to Opus. The run header can switch models mid-run, for Claude through the SDK and for ACP agents through `session/set_config_option` when the agent reports a model list.
2. **Phase stepper** at the top of the chat: Context · Questions · Confirm · Spec · Mockups · Check. Driven by simple signals: the `What I found` brief, the question count, `Status: Confirmed`, files appearing under `mockups/`, the check script's run. Answers "where am I, how long is left".
3. **Question card upgrades:**
   - Number them ("Question 4 · about 6–10 total").
   - Show the **"Decides …"** context line above the picker as its own line, not mixed into chat.
   - Keyboard: 1–4 picks an option, Enter submits, `o` focuses Other.
   - An **"Explain with an example"** button that sends a canned follow-up instead of an answer (from research round 3).
   - Previews rendered **side by side** in a monospace panel on wide screens, not below.
4. **Notifications when the agent needs you:** browser `Notification` plus the tab title ("● Needs you – spec-it") while a question or approval waits. Runs are long, so people switch tabs.
5. **Cost and token meter with an optional budget:** "$1.20 of $5" in the header, with a warning at 80%. Claude gives exact cost; for ACP agents show tokens when `usage_update` arrives.
6. **Collapse tool noise:** group consecutive tool rows into one expandable line ("Read 6 files, ran check twice"), with the latest one live. Subagent work nests under its parent.
7. **Better empty and error states:** "Not logged in" errors get a **Copy login command** button; "agent not installed" links to its install page; a failed `npx` download says so plainly.

### Next round (high value, medium effort)

8. **Spec review mode:** render REQUIREMENTS.md with **FR/EC chips** that jump between the spec and the mockup state that shows them (`?state=` + `data-fr` highlight). Includes a table of contents and the check script's warnings inline next to the lines they flag.
9. **Comment-to-revise:** select text in the spec, or click a mockup element in "Comment" mode, and leave a note. Notes collect in a tray; **"Send N changes"** sends one `--revise` message listing them with their FR/EC IDs. This is the Lovable/Bolt batch pattern, and it reuses the skill's existing revise flow.
10. **Mockup toolbar:** state switcher (`populated / empty / error / EC-n`), stress toggle, width presets (375 / 768 / 1440) and a trace overlay (`A`), controlling the iframe's query string instead of asking people to know the URL params.
11. **Run history that survives restarts:** persist the event log to `spec-it/<name>/.run/events.jsonl`; list past runs with their outcome; **Resume** through Claude's session resume or ACP `session/load` where supported.
12. **Export / share:** buttons for `export.mjs` (single-file mockups) and "Copy spec as Markdown".

### Later (bigger bets)

13. **Quick mode vs. full mode** at setup: quick caps questions at about 5 and skips the critic; full is today's flow. Like Kiro's Quick spec.
14. **Agent comparison:** run the same idea on two agents in split view (useful for your evals, too).
15. **Desktop wrapper** (Electron or Tauri) for a real installer, a tray icon and native notifications. Only after the web UI settles.
16. **Folder picker fallback:** an in-app directory browser for Linux machines without zenity or kdialog.

## Notes on the model dropdown

- **Claude:** the SDK's `model` option and `query.setModel()` mid-run. The list uses full model IDs so the choice is explicit. "My Claude Code default" passes nothing, so `settings.json` wins; that's why the first test ran on Haiku.
- **ACP agents:** no list before connecting. After `session/new`, a `configOptions` entry with `category: "model"` (type `select`) fills the header switcher; changes go through `session/set_config_option`. Agents without it keep their own default, and the switcher stays hidden.
- **Recommendation:** default to **Opus 5.5**. Question quality is the product. Sonnet 5.5 is the budget option.

## Sources

- Kiro specs: [overview](https://kiro.dev/docs/specs/index), [quick spec](https://kiro.dev/docs/specs/quick-spec/), [web specs review](https://kiro.dev/docs/web/specs/)
- Zed: [agent panel docs](https://zedhub.dev/ai/agent-panel), [ACP model selection commit](https://git.secluded.site/zed/commit/4e6e424fd78f2c024eff88efaaca4878379a5472)
- Visual edit patterns: [Bolt visual edits](https://support.bolt.new/building/visual-edits), [Lovable visual edits](https://lovable.dev/ko/blog/introducing-visual-edits), [Lovable toolbar modes](https://www.createwith.com/tool/lovable/updates/lovable-launches-new-toolbar-with-four-interaction-modes-for-visual-editing)
- Agent UX: [CHI 2026 workshop paper](https://arxiv.org/html/2603.10664), [Agent UX checklist](https://www.agenticwire.news/article/agent-ux-design-patterns), [8 UX patterns for agents](https://pub.towardsai.net/designing-for-ai-agents-8-ux-patterns-that-build-trust-in-2026-713a0c926933)
