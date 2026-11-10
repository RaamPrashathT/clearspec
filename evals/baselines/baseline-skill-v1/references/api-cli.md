# API and CLI artifacts

Both use `assets/fixtures.js` for every value, `assets/theme.css` and `assets/app.js` for styling and switchers, and the markup conventions in `references/screens.md` § Markup conventions (`data-fr`, `data-ec`, `data-state`, `data-bind`). They are reading surfaces: clear hierarchy and quiet styling, no signature move needed.

## API products

**Inventory.** List endpoint groups (a resource or a workflow), at most 12. Each group lists its endpoints and the ECs it covers.

**`api/index.html`**, one section per endpoint:
- Mark the section `data-endpoint="GET /households/{householdId}/balances"` (method, space, path exactly as in `openapi.yaml`) and `data-fr`.
- Purpose in one sentence, auth requirement, path and query parameters with types and limits.
- A request example and a success response example built from fixture values.
- Pagination, filtering, sorting, and idempotency behavior when they apply.
- Every error case as its own block with `data-ec` and `data-state` (for example `data-state="not-found"`): status code, error body, and when it happens. Use one error body shape across the API.
- Navigation: a sidebar or top list of endpoint groups linking to section anchors.

**`api/openapi.yaml`**: an OpenAPI 3.1 draft that agrees with the page. Every `data-endpoint` on the page has a path and method here, and the reverse; the check script compares them. Include schemas for the resources and the shared error body, and the security scheme. Use fixture values in `example` fields.

## CLI products

**Inventory.** List command groups, at most 12. Each group lists its commands, flags, and the ECs it covers.

**`cli/index.html`**, one section per command, marked `data-command="splitly settle"` and `data-fr`:
- Synopsis line, then a flag table (flag, type, default, description).
- The `--help` output as a transcript.
- The happy path as a transcript.
- Every error case as its own transcript with `data-ec` and `data-state`: the exact message, where it goes (stderr or stdout), and the exit code.
- Interactive prompts, if any, and both output formats when `--json` is in scope.
- Config precedence (flag, env var, config file, default) when the CLI has configuration.

**Transcript markup.** Render each transcript as:
```html
<figure class="transcript" data-state="error-no-household" data-ec="EC-4">
  <figcaption>No household configured</figcaption>
  <pre><code><span class="prompt">$</span> splitly settle --to raj
<span class="stderr">error: no household selected. Run `splitly use &lt;household&gt;` first.</span>
<span class="exit">exit 2</span></code></pre>
</figure>
```
Use real-looking paths, IDs, and timestamps from the fixtures. Keep exit codes consistent across commands and list them in one table at the top of the page.
