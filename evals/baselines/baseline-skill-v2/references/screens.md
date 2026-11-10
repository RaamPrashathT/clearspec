# Screens (UI products)

## Contents
- Inventory
- Fixtures
- Design plan (`design.md`) and the genericness test
- Tokens
- Markup conventions (shared with API and CLI artifacts)
- Quality floor
- AI tells to refuse
- Copy

## Inventory

Screens are **Operate** surfaces: the visitor comes to finish a task. Navigation, layout model, and controls follow the category's standards. The design world contributes four things only: type, palette, density, and one signature move.

List each screen as `NN-kebab-name` with a one-line purpose, the FRs it shows, and its states. Every `EC-n` must appear as a state of some screen. Typical states: `populated`, `empty`, `loading`, `error`, `denied`, plus one per edge case (`rounding`, `amount-changed`). At most 12 screens per unit; `index.html` and `design-system.html` do not count. Screens live in `mockups/` as `NN-name.html`.

## Fixtures

`mockups/assets/fixtures.js` is the single source of truth for every name, ID, amount, and date in every artifact. Write it before any HTML.

```js
window.FIXTURES = {
  meta: { product: "Splitly", locale: "en-US", currency: "USD", today: "2026-11-03" },
  members: {
    m1: { name: "Ana Souza", initials: "AS" },
    m2: { name: "Raj Patel", initials: "RP" }
  },
  expenses: {
    "e-4182": { title: "Internet, November", amount: 60, paidBy: "m2", date: "2026-11-01" }
  },
  stress: {
    members: { m1: { name: "Maximiliana Alexandra Montgomery-Okonkwo", initials: "MM" } },
    expenses: { "e-4182": { title: "Internet and streaming bundle for the whole flat, November and December", amount: 128450.5 } }
  }
};
```

- Key collections by ID so paths stay stable: `members.m1.name`.
- Include deliberate extremes in the base data: a zero value, an overdue or failed item, one empty collection. Put the longest strings and largest numbers under `stress`, which mirrors the base paths and overrides them when `?stress=1`.
- Use plausible, diverse names and real units. Dates are ISO strings; formatting happens in `app.js` with `Intl`.

## Design plan

Write `design.md` in the unit folder before tokens or HTML (with 2+ units, extend `spec-it/shared/design.md` instead):

```
# Design: <product>
Mode: Operate
Use scene: <who, where, what device, what light>
Theme: light | dark, chosen from the use scene
Palette: 4–6 named colors in OKLCH or hex, each with its role
Type: families and roles (system stack only; no bundled or web fonts)
Density: compact | regular | relaxed, and why
Layout: one sentence + an ASCII sketch of the primary screen
Signature move: <one concrete, domain-specific device>
Principles: 3 lines
Rejected defaults: <AI tells this plan avoids, and what it does instead>
```

**Genericness test.** Before committing, ask: would I write this same plan for any similar product? For each part where the answer is yes, revise it from the product's own subject, audience, and use scene, and note the change under Rejected defaults.

**Design question.** One picker question, counted toward the budget, asked before the build-mode checkpoint (SKILL.md phase 8): the direction in two lines of context, then options such as "This direction (Recommended)", "Also show 2–3 layouts to choose from" (`?variant=`), and "Explain with an example", each option's preview holding an ASCII sketch. Variants differ in navigation model, which data leads, or density, never only in color.

## Tokens

Start from `assets/theme.css`. Set primitives in OKLCH, map them to the semantic roles, and keep the `@pair` comments current: the check script computes WCAG contrast for every pair and fails below the stated minimum. Screens use semantic roles only. Spacing comes from the 4 px scale.

## Markup conventions

These attributes are how `app.js` and the check script read every artifact. Use them exactly.

| Attribute | On | Meaning |
|---|---|---|
| `data-fr="FR-3 FR-7"` | the element that implements the requirement | trace; shown by the `A` overlay |
| `data-ec="EC-2"` | the container that shows the edge case | trace; every EC needs one |
| `data-state="empty"` | a container shown only in that state (space-separated for several) | `?state=` switcher |
| `data-default-state="populated"` | `<body>` | state when no `?state=` is given |
| `data-states="all"` | `<body>` of `api.html` and `cli.html` | every state stays visible; `?state=` scrolls to it and marks it |
| `data-variant="B"` | a container shown only in that variant | `?variant=` switcher |
| `data-bind="members.m1.name"` | an element whose text comes from fixtures | filled by `app.js`; stress overrides apply |
| `data-format="money"` | with `data-bind` | `money`, `number`, `date`, `datetime`, `relative` via `Intl` |
| `data-next="04-checklist.html"` | `<form>` | submitting navigates to that artifact; no `method` or `action` (mockups have no server) |

Every `data-bind` path must exist in `fixtures.js`; the check script evaluates the fixtures and fails on a missing path. When a screen needs a value the fixtures lack, add it to the fixtures instead of showing a placeholder.

Each screen starts from `assets/screen.html`, links `assets/theme.css`, `assets/fixtures.js`, and `assets/app.js`, and has a `<title>` and one `<h1>`.

## Quality floor

- WCAG 2.2 AA: text contrast 4.5:1, large text and UI parts 3:1; visible `:focus-visible` on every control; targets at least 24×24 px; no horizontal scroll at 320 px; color is never the only signal.
- Semantic HTML: `<button>` for actions, `<a>` for navigation, `<label>` for every input, `<table>` for tabular data with `<th scope>`. Icon-only buttons get `aria-label`; decorative icons get `aria-hidden="true"`.
- `aria-live="polite"` on toasts and inline validation. Errors sit next to their field.
- Responsive at 375, 768, 1024, 1440 px. Long text truncates or wraps on purpose; flex children get `min-width: 0`.
- `font-variant-numeric: tabular-nums` in numeric columns; body measure 65–75ch; `text-wrap: balance` on headings.
- Destructive actions show a confirm step or an undo.
- Icons are inline SVG from one consistent stroke set.
- Browser surfaces are themed: `::selection`, caret, scrollbars, focus ring (already in `theme.css`).

## AI tells to refuse

These are defaults, not choices. Use one only when the developer asks for it.
- Indigo or purple as the default accent; gradient washes; gradient text.
- Cream background with a serif display and terracotta accent; near-black with one acid-green accent.
- The SaaS card kit: identical rounded cards, one radius everywhere, the same soft shadow on everything; nested cards.
- ALL-CAPS eyebrow labels above headings; `A · B · C` meta strings; `→` appended to buttons; section numbers on non-sequences.
- The hero-metric template (big number, small label, accent) as a dashboard's main idea.
- A thick colored left border on cards or alerts; emoji or Unicode glyphs as icons; monospace as decoration.
- The same fade-in on every section.

Spend boldness in one place, the signature move. Keep everything around it quiet.

## Copy

- Sentence case for headings and buttons. Curly quotes and `…` in rendered copy.
- Name things in the user's terms from the glossary, never the system's.
- A button says what happens ("Record payment"); the same action keeps its name through the flow (button "Record payment", toast "Payment recorded").
- Errors state what happened and how to fix it. Empty states say what to do next and offer the action.
- Every string comes from the fixtures or from the spec's language. No lorem ipsum.
