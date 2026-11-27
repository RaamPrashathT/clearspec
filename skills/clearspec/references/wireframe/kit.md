# Wireframe kit: vocabulary

For how to arrange pieces on common screens, see `recipes.md`. 

A screen spec is JSON. Every node is `{ "type": "...", ...props }`. Children go in `"children": [...]`. Strings are plain text. Unknown types or props fail the render. Never write HTML or CSS.

## Files

```
specs/app.json                  { "name", "user": {"name","sub"}, "nav": [{"label","screen"}] }
specs/screens/SCR-<kebab>.json  one per screen
```

Screen:

```json
{
  "id": "SCR-checklist",              // SCR-kebab-case, same as the file name
  "title": "Checklist",
  "serves": ["FR-8"], "edge": ["EC-1"], // requirement and edge-case ids shown as tags
  "shell": "app",                     // "app" (default, top nav) or "none" (centered, e.g. sign-in)
  "layout": "wide",                   // optional, with shell "none": do not center
  "activeNav": "SCR-team",            // optional: highlight another screen's nav item (sub-screens)
  "notes": ["behavior a picture can't show"],
  "default": "populated",             // optional, else the first state
  "body": [ nodes ],                  // shared body, used by any state without its own
  "states": {
    "populated": { "label": "Populated" },
    "empty":     { "label": "No habits", "body": [ nodes ] },
    "confirm":   { "label": "Confirm", "overlay": nodes, "notes": ["..."] }
  }
}
```

`overlay` is drawn over the screen (a `dialog` or a `toast`). A state with no `body` shows the screen `body`.
`to` on a `button` or `link` is a screen id, and becomes a working link.

## Pieces

Layout

| type | props |
|---|---|
| `stack` | `gap` 0-8 (default 3), `align`, `children` |
| `row` | `gap`, `align`, `justify` (start, center, end, between), `wrap`, `children` |
| `grid` | `cols` number or `{mobile,tablet,desktop}`, `gap`, `children`. Collapses by viewport. |
| `divider`, `spacer` | `spacer`: `size` |

Text

| type | props |
|---|---|
| `heading` | `text`, `level` 1-3, `sub`, `actions` (buttons on the right) |
| `text` | `text`, `muted`, `size` (sm, lg), `strong` |
| `link` | `label`, `to`, `external` (adds the square-out icon) |
| `icon` | `name`, `size` |

Controls

| type | props |
|---|---|
| `button` | `label`, `variant` (primary, secondary, ghost, danger), `size` (sm, md, lg), `icon`, `iconRight`, `disabled`, `full`, `to`. No `label` = icon-only. |
| `input` | `label`, `placeholder`, `value`, `inputType` (text, password, email...), `icon` (left), `iconRight` (button inside, e.g. copy, x), `suffix`, `help`, `error`, `required`, `disabled` |
| `textarea` | `label`, `placeholder`, `value`, `rows`, `help`, `error` |
| `select` | `label`, `options` (strings), `value`, `help`, `error`, `disabled` |
| `checkbox` | `label`, `checked`, `indeterminate`, `help`, `disabled`, `emphasis` (bordered button-style control, filled when checked: use for the main repeated action, e.g. "Done today") |
| `radio` | `label`, `name`, `checked`, `help` |
| `toggle` | `label`, `on`, `help` |
| `dropdown` | `label` and/or `icon` (trigger), `items`: `{label, icon, hint, danger, checked}` or `{divider:true}`, `open` (draw the menu open), `align` (end), `reserve` (leave room under an open menu) |

Display

| type | props |
|---|---|
| `badge` | `label`, `tone` (neutral, solid, outline, dashed, success, danger, warning, info), `icon` |
| `avatar` | `name`, `size` (sm, md, lg). Initials only. |
| `avatar-group` | `names`, `max`, `size` |
| `person` | `name`, `sub`, `size` (avatar + name + subtitle) |
| `card` | `title`, `description`, `actions`, `children`, `footer`, `flush` (no body padding, for tables), `gap`, `emphasis` (stronger border and shadow: the one main workflow card) |
| `accordion` | `items`: `{title, open, children}` |
| `tabs` | `items`: `{label, active, badge}` |
| `alert` | `tone` (info, success, warning, danger), `title`, `text` |
| `empty` | `icon`, `title`, `text`, `action` (a button node) |
| `stat` | `label`, `value`, `hint` |
| `skeleton`, `progress` | `lines`; `label`, `value`, `max` |
| `dialog` | `title`, `description`, `children`, `actions`, `static` (draw inline, for a gallery) |
| `toast` | `text`, `icon` |

Data

| type | props |
|---|---|
| `table` | `columns`: `{key, label, align (right, center), width}`; `rows`: objects keyed by column `key`, each cell a string, number, null (shows a dash) or a node (`badge`, `person`, `status-strip`...); `_selected` marks a row; `toolbar`: `{title, search, actions}`; `selectable`, `rowActions`, `footer`, `pager`, `emptyText`. On mobile each row becomes a stacked card. |
| `status-strip` | `cells`: statuses, `today`: index to ring |
| `status-grid` | `rows`: `{label, aside, sub, cells: [7 statuses], meta (node)}`, `days` (default M..S), `today`, `legend` (drawn at the bottom; once per screen), `metaWidth`. `aside` is a small fact on the same line as the name (streak, count); `sub` is a second line. `meta` is a node on the right (a `badge`, an emphasized `checkbox`, or a `row` of both). |

Cell statuses: `done`, `backfilled`, `missed`, `todo`, `future`.
Use `status-grid` and `status-strip` for any "series of states over time" (check-ins, uptime, steps).

Icons: search, external-link, copy, x, check, plus, minus, chevron-down, chevron-up, chevron-left, chevron-right, menu, user, settings, trash, edit, more, info, alert, calendar, arrow-right, link, filter, image, mail, lock.

## Fit rules

- Need something the kit lacks? Use the nearest piece and put the gap in `notes` as `KIT GAP: ...`. Never invent a type.
- A `table` needs 2+ columns. One thing per row with a few fields is a `table`; a list of rich items is a `stack` of `card`s.
- `dropdown`, `dialog` and `toast` appear only as an `open` menu, an `overlay`, or `static`: one state per interesting moment.
- Real-looking sample content: names, amounts, dates. Keep the same people and numbers on every screen. Unknown values: `[TBD]`.
