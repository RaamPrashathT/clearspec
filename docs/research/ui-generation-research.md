# UI mockup generation research

Researched 2026-11-03. Goal: make `/spec-it` screens look like a shipped product, not like AI output.

## 1. Sources

| Source | What it gave us |
|---|---|
| [Anthropic `frontend-design` skill](https://github.com/anthropics/skills/tree/main/skills/frontend-design) | Design plan before code, a list of AI tells, a "genericness" self-test, restraint, UI copy rules |
| [Impeccable](https://github.com/pbakaus/impeccable) (Paul Bakaus, Apache-2.0) | Surface **modes** (Operate for app UI), a craft floor, a refuse list, layout/colour/type checks, Nielsen scoring, isolated critique passes |
| [Vercel Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines) | 100+ concrete a11y, forms, typography and content rules, written as a lint list |
| Addy Osmani `frontend-ui-engineering` | "Avoid the AI aesthetic" table, breakpoints, required states |
| Matt Pocock `prototype` (UI branch) | `?variant=` switcher, variants that are structurally different, mocking inside the real app shell |
| [W3C Design Tokens 2025.10](https://www.designtokens.org/) | First stable token format (a Community Group report, not a W3C Standard). Primitive vs semantic tokens |
| WCAG 2.2 AA, Nielsen's 10 heuristics | The accessibility floor and the critique rubric |
| [UICrit (UIST 2024)](https://arxiv.org/html/2407.08850v2), [visual prompting refinement](https://arxiv.org/html/2412.16829), [zero-shot GUI generation](https://arxiv.org/pdf/2412.11328), [RL from designer feedback](https://jasonwunix.com/assets/pdf/wu2025rldf.pdf) | Evidence on visual feedback loops (§5e) |

## 2. The floor: standards every screen must pass

**Accessibility (WCAG 2.2 AA)**
- Contrast: body text at least 4.5:1. Large text, icons, controls and focus rings at least 3:1.
- Focus: visible `:focus-visible` on every control. Never `outline: none` without a replacement.
- Targets and reflow: targets at least 24×24 px, and no horizontal scroll at 320 px. Colour is never the only signal.
- Semantic HTML before ARIA: `<button>` for actions and `<a>` for navigation; never a `<div onclick>`.
- Labelled form controls. `aria-label` on icon-only buttons and `aria-hidden` on decorative icons.
- Hierarchical headings and a skip link.
- `aria-live="polite"` on toasts and inline validation.
- `prefers-reduced-motion` respected.

**Forms** (Vercel)
- Correct `type`, `inputmode` and `autocomplete`.
- Errors appear inline next to the field.
- Placeholders show an example pattern and end with `…`.
- Destructive actions get a confirm step or an undo.

**Typography**
- Body measure 65–75 characters, with clear steps in the type scale.
- `font-variant-numeric: tabular-nums` in number columns.
- `text-wrap: balance` on headings.
- Use the real `…` character, and `&nbsp;` inside units like `10 MB`.

**Content handling**
- Long text truncates or wraps on purpose, and flex children get `min-width: 0`.
- Lists include short, average and very long items.
- Every list has an empty state.

**Tokens**
- Primitives (raw palette, scale steps) sit under semantic roles: canvas, surface, text-primary/secondary, action, focus, border, success/warning/error/info.
- Screens use only the semantic roles. Name tokens DTCG-style so they can be exported later.
- Spacing comes from a 4-px base scale.

**Critique rubric:** score Nielsen's 10 heuristics 0–4. Impeccable notes that most real interfaces land at 20–32 out of 40.

## 3. What separates good AI-generated UI from generic

1. **Name the mode first.** Our screens are **Operate** (task-focused app UI). Here the visual style contributes four things only: **type, palette, density and one signature move**. Navigation, layout model and controls stay standard for the category. On product screens, ambition shows as precision and restraint. (Impeccable)
2. **Ground the design in the subject.** Palette, type and the signature move come from the product's own domain and audience, not from a default look for the category. (Anthropic)
3. **Write a design plan before any code:**
   - 4–6 named hex or OKLCH colours
   - type families and their roles
   - a layout concept as one sentence plus an ASCII sketch
   - 3 principles

   Then **review the plan against the brief**: would you arrive at the same plan for any similar product? If so, revise that part and say what changed. (Anthropic)
4. **Refuse the known AI tells:**
   - cream background with a serif display and a terracotta accent
   - near-black with one acid-green accent
   - the SaaS card kit: identical rounded cards, one radius, `rgba(0,0,0,.1)` shadows, gradient washes
   - an ALL-CAPS eyebrow label above headings
   - `A · B · C` meta strings
   - `→` appended to buttons
   - indigo or purple by default
   - gradient text
   - nested cards
   - a thick coloured `border-left` on cards
   - the hero-metric template
   - emoji used as icons
   - monospace used as decoration

   (Anthropic, Impeccable, Osmani)
5. **Spend boldness in one place.** One memorable element, with everything around it quiet. Take one accessory off before you leave the house. (Anthropic)
6. **Copy is design.**
   - Name things in user terms ("notifications", not "webhook config").
   - Buttons say what happens ("Save changes"), and the action keeps that name through the flow ("Publish" leads to a "Published" toast).
   - Errors say what went wrong and how to fix it.
   - Empty states invite the next action.
7. **Theme the browser's own surfaces:** text selection, the caret, scrollbars, focus rings, link underline offset and tabular numerals. This is the cheapest sign that a page was built rather than assembled, and models skip it most often. (Impeccable)
8. **Colour does work.** It encodes action, selection, status and wayfinding. A grey screen with one accent colour is a default, not restraint. Use OKLCH ramps and reduce chroma near white and black. Design dark mode separately rather than inverting the light theme. (Impeccable)

## 4. Where the sources disagree

| Topic | Positions | Our choice |
|---|---|---|
| Heading and button case | Vercel: Title Case. Anthropic, Material, unslop: sentence case | **Sentence case.** It reads as more modern and is easier to keep consistent. |
| Quotes in UI copy | Vercel: curly. unslop: straight (for prose and docs) | **Curly quotes and `…` in rendered UI copy**, straight quotes in code and in the spec. |
| Light vs dark | Many generators default to dark for "tech" | Pick from the **use scene** (who, where, what ambient light), then confirm it in the one design question. |
| Icons | Unicode or emoji is common | **Inline SVG** from one consistent stroke set, authored or bundled. No CDN. |

## 5. Ideas that beat the standards

These go past what any standard requires, and each makes the output measurably more reliable or more consistent.

**a. Fixture-first data.** Before any screen, write one `screens/assets/fixtures.js`: the users, entities, IDs, amounts and dates, plus deliberate edge cases (a 48-character name, a zero balance, an overdue item, an empty list).
- Screens take their values from it, rendered by a few lines of vanilla JS or copied into static HTML.
- *Why it's better:* consistency across screens holds by construction instead of depending on the model's memory, and a script can verify it. Today's generators drift ("Sarah" on one screen, "Sara" on the next).

**b. Token-first theme with machine-checked contrast.** `theme.css` declares the semantic roles once. `check-tokens` computes the contrast of every declared foreground/background pair (OKLCH converted to sRGB, using the WCAG formula) and fails below AA.
- *Why it's better:* contrast is proven by calculation, not judged by eye. Impeccable insists that eyesight alone is not enough.

**c. A state matrix taken from the spec.** Every edge case `EC-n` in the spec maps to a screen state. Each screen gets a small in-page switcher: `?state=populated|empty|loading|error|denied` plus a floating pill (Pocock's `?variant=` pattern).
- The trace check fails when an edge case has no state.
- *Why it's better:* the mockups show the edge cases the interview uncovered, which is the point of the whole skill. Standards only say "handle states"; this ties each state to a requirement.

**d. Plan, then a genericness test, then build.** The design plan from §3.3 goes into `screens/DESIGN.md` before any HTML, with a short note on each AI tell it rejected and why.
- *Why it's better:* fixing a plan costs far less than restyling ten screens, and the file shows reviewers the design rationale.

**e. A render-and-look loop, batched.**
- Serve `screens/` on localhost (`npx serve`, or `python -m http.server` as the fallback; Impeccable avoids `file://` for browser checks).
- Screenshot each screen at 375 and 1440 px in the built-in browser pane, or with Playwright if installed.
- Fix everything one look reveals before looking again.
- *Evidence, stated honestly:* visual prompting raised the quality of LLM UI critique by about 55% in UICrit, and designer feedback on rendered screenshots improved generation models when used in training. No paper we found proves that an inference-time screenshot loop improves final generation quality. So treat this as best practice backed by evidence on critique, and keep it optional when no browser is available.

**f. An isolated critic.** A fresh-context subagent reviews the screenshots and HTML without the generator's reasoning. It returns:
- Nielsen scores
- AI-tell findings
- a squint-test verdict: can you still see the primary element, the secondary element and the groups when the page is blurred?
- the top 5 fixes

The generator applies the fixes once. *Why it's better:* the model that built the screen is biased toward it. Both Impeccable and Osmani separate building from judging.

**g. A deterministic mockup lint** (added to `check-trace.mjs`). It fails on any of:
- lorem ipsum
- `outline: none` without a replacement
- `transition: all`
- `<img>` without `alt` or dimensions
- icon-only buttons without a label
- unlabelled inputs
- `<div onclick>`
- external URLs or CDNs
- `...` in copy
- an element that implements a requirement but has no `data-fr`

*Why it's better:* these are free, exact checks for the rules models break most often.

**h. A stress toggle.** `?stress=1` swaps in the fixture extremes: long names, roughly 35% longer pseudo-localised strings, and large numbers. *Why it's better:* layouts that break on real content get caught in the mockup instead of in production.

**i. Variants only where they pay off.** The primary screen can get 2–3 **structurally different** layouts (different navigation model, a different lead area, a different density), switched by `?variant=`. This costs one interview question, and the developer picks a winner. *Why it's better:* choosing between real options beats approving the first draft, but doing it for every screen is too expensive.

**j. Mock inside the real shell.** When the repo has an existing app, reuse its header, nav and tokens, so new screens are judged in context. (Pocock: "an empty route hides design problems".)

## 6. The pipeline for `/spec-it` phases 4–5

1. **Screen inventory and state matrix** from the spec's FRs and edge cases. The developer confirms them.
2. **Fixtures:** `screens/assets/fixtures.js`.
3. **Design plan:** `screens/DESIGN.md` with mode = Operate, palette, type, layout sketch, signature move, rejected AI tells. Confirm it with the one design question.
4. **Tokens:** `theme.css`, then `check-tokens`, fixing until it passes.
5. **Build:**
   - `design-system.html` first
   - then the screens, using the fixtures
   - a state switcher on each screen, plus the `data-fr` overlay
   - `index.html` last
6. **Lint and trace check:** `check-trace.mjs` (§5g plus the trace rules), fixing until it passes.
7. **Look** (when a browser is available): screenshot at 375 and 1440 px, then run the isolated critic and apply one batch of fixes.
8. **Optional variants** for the primary screen, if the developer said yes.

## 7. What we leave out

- **Impeccable's binary CLI and live mode:** an external dependency that is heavy and Apache-2.0. We take its ideas, not its tooling.
- **Vercel's React-only rules** (hydration, virtualization, `nuqs`): they don't apply to static mockups.
- **Web fonts from Google Fonts or a CDN:** they break offline use. Use a deliberate system font stack, or bundle one `woff2` in `assets/` when the design needs a specific face.
- **Motion beyond one moment:** these are mockups, so state changes are instant and `prefers-reduced-motion` is respected.
