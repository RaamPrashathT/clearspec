# UI wireframe design rules

Apply these while writing `mockups/specs/screens/*.json`. The renderer's lint enforces the objective ones (it prints `lint:` messages); the rest are judgment.

**Density is rendered, so write both essential and secondary content.** The developer picks Dense, Standard or Roomy per screen in the compare page. Dense hides secondary text: card `description`, field `help`, checkbox `help`, status-grid `sub`, `stat` `hint`, dialog `description`, `person` `sub`. Put a fact the reader needs in a visible field (title, label, `aside`, badge). Put nice-to-have context in the secondary fields.

**Spend little vertical space.** The screen's main job is visible without scrolling: roughly the first 700px on desktop and the first 800px on mobile.
- Title and the screen's key action share one row: `heading` with `actions`. The subtitle is one short line of context. Rules and limits go to `notes`, never into the subtitle.
- A small fact sits next to the thing it describes: streaks, counts and rates go in `aside` on a `status-grid` row, or in a `badge`. `sub` is for a real sentence.
- A card gets a `title`. A `description` only if the reader needs it, under 6 words, never repeating the title.
- Small things go side by side: `grid` for stats (3 across). Never put a `status-grid` in a multi-column grid.
- One legend per screen, on the first `status-grid` that uses those statuses (`legend: true`).
- Never repeat a card's title as its field label, and do not repeat help text on every row.

**Make hierarchy obvious.**
- One primary action per screen (`button` `variant: primary`). Cancel, back and secondary actions are `secondary` or `ghost`. Destructive actions are `danger` and last.
- The action people repeat most gets emphasis: a repeated "done / mark / ack" checkbox is `checkbox` with `emphasis: true`. `card` `emphasis: true` marks the one main workflow card, at most one per screen.
- Order each screen: title and primary action, the main work area, supporting information (stats, history), rarely used things (settings, legends).
- Secondary text is `muted`. State is a `badge` tone, not a sentence. One level 1 `heading` per screen; section names are card titles.
- An empty state is one sentence and one action.

**Lint** (errors unless noted): a single field in a card needs a `width`; no full-width button inside a card (except `shell: "none"` forms); a field label must not equal its card title; no `status-grid` in a multi-column `grid`. Warnings: long card descriptions, long subtitles, more than one primary button, very tall pages.

**Rules.** Do not invent screens or features the spec does not need. Do not choose colors, fonts, themes or a density: the kit is grayscale and the developer picks the density. Use the same people, numbers and dates on every screen (they come from `mockups/inventory.md`). Anything undecided is `[TBD]`.
