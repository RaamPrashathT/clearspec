# Layout recipes

Use the matching recipe for a screen or card. Recipes come from comparing real runs; the renderer lint enforces the objective parts.

## R1 Settings card (one field + Save)
```json
{ "type": "card", "title": "Team timezone", "description": "Admins only",
  "actions": [ { "type": "button", "label": "Save", "variant": "secondary" } ],
  "children": [
    { "type": "select", "label": "Timezone", "value": "Europe/Lisbon", "width": "320px",
      "options": ["Europe/Lisbon", "Europe/London"], "help": "Applies to later check-ins only" } ] }
```
- The field label is shorter than, and never equal to, the card title.
- A single field always has `width` (about 320px; 480px for long text). Never a full-width select.
- The Save button sits in the card's `actions`, never a full-width button below. It is `secondary` unless it is the only primary on the screen.
- One short description, six words or fewer, or none. Help text goes under the field.

## R2 Series card (a status-grid per habit, metric, or checklist)
```json
{ "type": "card", "title": "Stand-up on time",
  "actions": [ { "type": "row", "gap": 2, "children": [
      { "type": "text", "text": "75%", "strong": true, "size": "lg" },
      { "type": "text", "text": "9 of 12 this week", "muted": true, "size": "sm" } ] } ],
  "children": [ { "type": "status-grid", "today": 1, "legend": true,
      "rows": [ { "label": "Ana Souza", "aside": "Streak 4", "cells": ["done", "..."] } ] } ] }
```
- One full-width card per series, in a plain `stack`. Never put a status-grid in a multi-column `grid` (lint error: too narrow).
- The headline number (rate, count) goes in the card's `actions` as large strong text, with its detail beside it in muted small text. Not as a body line.
- `legend: true` on the first card only. A retired or inactive series is a normal card with a `badge` (tone `dashed`) in `actions`, and no legend.
- The name and its streak or count share a line (`aside`).

## R3 Checklist (my own items, tick today)
- Same as R2, with `meta` on each row: a `badge` for the rate and a `checkbox` with `emphasis: true` ("Done today"). Shared and private series are separate cards.
- The screen's one repeated action is the emphasized checkbox; the other buttons are `secondary` or `ghost`.

## R4 List screen (table)
- `heading` with `actions` holding the one primary button ("New habit"). Then a `table` with `toolbar.search`, `rowActions: true`, a `footer` count. Status columns use `badge`. No second heading, no description card around the table.
- Empty state replaces the table: `empty` with one sentence and one action.

## R5 Auth or invite form (`shell: "none"`)
- One centered `card`: heading with a one-line `sub`, fields, one full-width primary `button`, then a `row` of `link`s (`justify: "between"`). Errors: `alert` danger at the top of the card plus `error` on the field. A full-width button is allowed here only.

## R6 Confirm dialog
- `overlay` `dialog`. Title is the question ("Retire this habit?"), `description` is the consequence in one sentence. Actions: Cancel (secondary) then the confirm button. A destructive confirm is `variant: danger`. Add a `checkbox` only for irreversible actions.

## R7 Create or edit dialog
- `overlay` `dialog` with the fields as children (labels short, required marked), Cancel then the primary on the right. No cards inside a dialog.

## R8 Summary strip
- At most 3 `stat` in a `grid` (`cols` 3), above the main content, only if the numbers are not already visible in the content. Otherwise skip it; the content is the summary.

## R9 Empty, loading and error states
- Each is a state of the same screen: `empty` (one sentence, one action), `skeleton` for loading, `alert` danger with a retry button for errors. Keep the page heading and navigation so the screen stays recognizable.
