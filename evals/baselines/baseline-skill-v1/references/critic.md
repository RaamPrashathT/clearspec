# Look and critique (UI products)

Run this after the check script passes, only when a browser tool is available.

## Look

1. Start the static server in the background: `node <skill dir>/scripts/serve.mjs specs/<slug>`. It prints its URL (default `http://localhost:4173/`) and its PID, and stops by itself after 30 idle minutes.
2. For each screen, capture its default state at 375 px and 1440 px wide, plus `?stress=1` at 375 px. Add `&pill=0` to hide the switcher. Save screenshots to the session's scratch directory, not into `specs/`. Capture one screen at a time; if one capture fails, retry it once at a single width before moving on.
3. Stop the server you started, using its background task or its printed PID. Never stop processes by name or pattern: the developer may run their own preview server.

If screenshots keep failing, use the source-only fallback below and state in the final report that the visual pass did not run.

## Critic brief

Send to one fresh-context subagent (in build mode B, do the review yourself with the same instructions). It sees only the screenshots and files, not how they were built.

```
Review the UI mockups of a product spec as a demanding product designer.

Files: <spec dir>/screens/*.html, <spec dir>/screens/DESIGN.md, <spec dir>/assets/theme.css
Screenshots: <list of absolute paths, each labeled screen · width · state, or "none: source-only review">
Quality bar: <skill dir>/references/screens.md (quality floor, AI tells, copy)

Report, in this order and nothing else:
1. Nielsen's 10 heuristics, each scored 0–4 with one line of evidence. Total out of 40.
2. Squint test: with detail blurred, are the primary element, the secondary element, and the groups still clear on each screen? Name each screen that fails. Source-only: judge from the markup order and the type and spacing tokens.
3. AI tells found, each with screen and element.
4. Stress risks: overflow, truncation, or broken layout with the fixtures' stress values.
5. Top 5 fixes, most important first, each as: screen · element · problem · concrete change.

Do not edit files.
```

## Apply

Apply the top fixes in one batch, through the build mode chosen in phase 5 (one renderer brief per affected screen, with the fix lines added), then run the check script again. One critique round per run unless the developer asks for another.
