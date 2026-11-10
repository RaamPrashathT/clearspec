# API and CLI artifacts

## Contents
- Shared rules
- API products
- CLI products: interview probes
- CLI products: transcripts.md (runnable)

## Shared rules

API and CLI artifacts live in the unit's `mockups/` next to any screens. They use `mockups/assets/fixtures.js` for every value, `assets/theme.css` and `assets/app.js` for styling and switchers, and the markup conventions in `references/screens.md` § Markup conventions (`data-fr`, `data-ec`, `data-state`, `data-bind`). They are reading surfaces: clear hierarchy and quiet styling, no signature move needed. Mixed products share one `fixtures.js`, so the same people, IDs, and amounts appear on screens and in API examples, and an FR can list several artifacts in `Shown in:`.

## API products

**Error format.** Use RFC 9457 problem details as the one error body for every endpoint, unless the developer gave their own error format, in which case use theirs everywhere:

```json
{ "type": "https://example.com/problems/slot-taken", "title": "Slot already booked", "status": 409, "detail": "Room Orchid is booked 10:00–10:30.", "instance": "/bookings/b-2231" }
```

Serve errors as `application/problem+json`. Each problem `type` is a stable URI listed once in the error catalog on the page.

**Inventory.** Endpoint groups (a resource or a workflow), at most 12 per unit, each listing its endpoints and the ECs it covers.

**`mockups/api.html`**, one section per endpoint:
- Mark the section `data-endpoint="GET /households/{householdId}/balances"` (method, space, path exactly as in `openapi.yaml`) and `data-fr`.
- Purpose in one sentence, auth requirement, path and query parameters with types and limits.
- A request example and a success response example built from fixture values.
- Pagination, filtering, sorting, rate limits, and idempotency behavior when they apply.
- Every error case as its own block with `data-ec` and `data-state` (for example `data-state="not-found"`): status code, the problem body, and when it happens.
- An error catalog (every problem `type`, its status, and its meaning) and a navigation list of endpoint groups linking to section anchors.

**`mockups/openapi.yaml`**: an OpenAPI 3.1 draft that agrees with the page. Every `data-endpoint` has a path and method here, and the reverse; the check script compares them. Include schemas for the resources and the problem body, the security scheme, and fixture values in `example` fields. No mock server: the page and the YAML are the API preview.

## CLI products: interview probes

Use these as interview questions where the request leaves them open (from clig.dev):
- Which failures need their own exit code? (0 success, non-zero per failure mode)
- Is machine-readable output needed (`--json`), and must it stay stable?
- Must it run without prompts in scripts and CI (`--no-input`, failing with the flag to pass)?
- How destructive is each command, and how much confirmation does it need: none, a prompt plus `--dry-run`, or a typed confirmation (or `--confirm=<name>`)?
- Where do settings come from? Precedence: flags, then environment variables, then project config, then user config.
- Are there subcommands? Keep one `noun verb` (or `verb noun`) pattern and the same flag names across them.

Transcript rules: results to stdout, errors and messages to stderr; `NO_COLOR` and non-TTY output turn color off; never accept secrets as flags or environment variables (use a file flag or stdin); errors say what happened and the next step.

## CLI products: transcripts.md (runnable)

`mockups/transcripts.md` is the source of truth. A coding agent runs it as snapshot tests (cram or trycmd style), and `scripts/cli-render.mjs` generates `mockups/cli.html` from it, so the page and the tests cannot drift apart. Never edit `cli.html` by hand.

````
# CLI: tool

## Exit codes
| Code | Meaning |
|---|---|
| 0 | success |
| 1 | nothing to clean |
| 2 | usage error |

## tool clean · FR-1 FR-2
Lists merged branches older than the threshold; deletes them with --apply.

### help
```console
$ tool clean --help
Usage: tool clean [options]
...
[exit 0]
```

### happy-path · FR-1
```console
$ tool clean --apply
Deleted 3 branches: fix/login, feat/old-nav, chore/deps
[exit 0]
```

### no-remote · EC-2 · FR-5
```console
$ tool clean --remote origin --no-input
! error: no remote named "origin". Pass --remote <name>.
[exit 2]
```
````

- `## <command> · <FR IDs>` opens a command, followed by one line of purpose.
- `### <state> · <IDs>` opens a transcript. The state name becomes its `data-state`; EC IDs become `data-ec`; FR IDs become `data-fr`.
- In a ` ```console ` block: `$ ` starts a command line, a leading `! ` marks a stderr line, and the block ends with `[exit N]`.
- Use fixture values for names, paths, IDs, and timestamps. Every exit code used appears in the table, and every EC has a transcript.

After editing `transcripts.md`, run `node <skill dir>/scripts/cli-render.mjs spec-it/<unit>`.
