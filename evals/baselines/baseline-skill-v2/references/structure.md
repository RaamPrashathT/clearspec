# Structure: modules, phases, and the roadmap

## Contents
- Module signals
- Shape checkpoint
- Phase checkpoint
- The four shapes
- roadmap.md
- Units, limits, and IDs
- Shared folder and consistency

The default is one module, one phase (1M1P). It needs no question, no extra table, and no extra folder. Everything below applies only when the developer chooses more.

## Module signals

After discovery, an area counts as a separate module when it meets at least two of these:

| Signal | Example |
|---|---|
| Different people or vocabulary | a "patient" at the front desk is a "payer" in billing |
| Owns its own data | only billing creates invoices |
| Could ship and be useful alone | booking works without reporting |
| Would need more than about 25 questions by itself | patient records with privacy rules |

Offer modules only when at least two areas qualify. User counts, team size, or how big an idea sounds are never signals.

## Shape checkpoint

Asked once, as `C<n>`, only when the signals hold. In the context block, name the areas and the signals each met, in one line per area. Then:

- **question:** "How do you want to continue?"
1. **Start with one area now** *(recommended)*: spec `<most important area>` fully; the rest goes to the roadmap
2. **Split into modules**: spec them one after another, one unit each
3. **Keep one spec**: questions only, up to 40
4. **Explain with an example**

With option 1 or 2, propose the modules in a table (module, what it owns, depends on, build order) and let the developer adjust names, order, or which area comes first before writing `roadmap.md`.

## Phase checkpoint

Asked once, as `C<n>`, only when the developer mentions an MVP, a first version, or "later", or when a unit's inventory would exceed 12 artifacts.

- **question:** "Build all of this at once, or in phases?"
1. **All at once** *(recommended)*
2. **In phases**: we pick what goes first, the rest becomes later units
3. **Explain with an example**

With phases, propose what each phase ships in one line each, and let the developer adjust.

## The four shapes

| Shape | When | Show the developer | `roadmap.md` map |
|---|---|---|---|
| 1 module, 1 phase | default | nothing extra | none |
| Several modules, 1 phase | modules chosen | module table: module, owns, depends on, order | the module table |
| 1 module, several phases | phases chosen | timeline: Phase 1 → 2 → 3 with what each ships | the timeline |
| Several modules, several phases | both chosen | grid: modules as columns, phases as rows | the grid |

## roadmap.md

`spec-it/roadmap.md`, created at intake for every product and updated at the end of every unit.

```
# Roadmap: <product>
Shape: 1 module, 1 phase · Limits: 6 modules, 3 phases (defaults)

## Units
| # | Folder | Module | Phase | Status |
|---|---|---|---|---|
| 1 | 1-habit-tracker/ | — | 1 | done |

## Map
<module table, timeline, or grid; omitted for 1M1P>

## Parked questions
- <unit or module>: <question> (raised in unit N)

## Deferred
- <area>: <why, and who decided>
```

- Status is `upcoming`, `current`, or `done`.
- **Parked questions:** a question raised in one unit that belongs to another goes here, not into the current interview. That unit's interview asks it first.
- **Deferred:** areas or artifacts moved out of the current unit, with the reason.

## Units, limits, and IDs

- **One unit per run.** A unit is the whole product (1M1P), one module, or one phase of a module. Each run ends with one complete, checked unit, then offers to continue with the next.
- **Folder names:** `<N>-<kebab-name>` in the order units are specced: `1-booking/`, `2-billing/`, `3-booking-no-shows/`.
- **Default limits:** at most 6 modules, and at most 3 phases planned in detail (later phases are one line each in the map). The developer can raise either limit; record it on the `Limits:` line. Never raise a limit on your own.
- **IDs:** with modules, prefix FR, EC, and A IDs with a short uppercase module code (`BOOK-FR-3`, `BILL-EC-2`). Without modules, plain `FR-3`. An ID keeps its number across phases.
- **Later phases** are full specs in their own unit for now; each cites the earlier unit's IDs it builds on.

## Shared folder and consistency

When the second unit starts:
1. Create `spec-it/shared/` with `design.md` (moved from unit 1) and `assets/theme.css` and `assets/fixtures.js` (copied from unit 1's `mockups/assets/`).
2. Each new unit copies `shared/assets/` into its own `mockups/assets/` and extends `fixtures.js` with its own data, keeping the existing people and IDs. Units stay self-contained.
3. Each new unit reads first: `roadmap.md`, `shared/design.md`, the glossary and data model of earlier units, and its parked questions. Terms and entities already defined are reused, not redefined.
