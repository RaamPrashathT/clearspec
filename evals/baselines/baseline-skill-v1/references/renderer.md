# Renderer brief

In build mode A, send one brief per artifact to a fresh-context subagent, in parallel. Fill every `<…>` with absolute paths and the artifact's own data; the subagent sees nothing else from this conversation. In build mode B, follow the same brief yourself for each artifact in turn.

```
Build one offline HTML artifact for a product spec.

Write exactly one file: <absolute path, e.g. D:/proj/specs/splitly/screens/03-add-expense.html>
Do not edit any other file.

Read these first:
- <spec dir>/screens/DESIGN.md            (UI only: the committed design direction)
- <spec dir>/assets/theme.css             (tokens; use semantic roles only)
- <spec dir>/assets/fixtures.js           (every name, ID, amount, date comes from here)
- <skill dir>/references/screens.md       (markup conventions, quality floor, AI tells, copy)
- <skill dir>/references/api-cli.md       (API and CLI artifacts only)
- <skill dir>/assets/screen.html          (skeleton to start from)

Artifact: <NN-name> · <one-line purpose>
Implements: <FR-n: title + acceptance criteria, one per line>
States: <state name → what it shows → EC-n, one per line; mark the default>
Variants: <none | A, B, C with the structural difference of each>
Navigation: <links to sibling artifacts by relative path, e.g. 06-settle-up.html>
Glossary: <terms to use exactly>

Rules:
- Put data-fr on each element that implements a requirement, data-ec and data-state on each state container, data-default-state on <body>.
- Use data-bind with data-format for fixture values; hard-code no names, amounts, or dates. If a value you need is missing from fixtures.js, do not invent a placeholder: list the missing path in your return summary.
- Forms get data-next="<next artifact>.html" and no method or action; the mockup has no server. Never put passwords or other secrets in a URL.
- No external URLs, CDNs, or web fonts. Icons are inline SVG.
- Meet the quality floor and refuse the AI tells in screens.md.
- Keep page-specific CSS in one <style> block that uses the theme's custom properties.

Before returning, check your file against the quality floor and the conventions table, and fix what fails.

Return at most 8 lines: the file path, the states built, the FRs and ECs covered, missing fixture paths, and anything you could not satisfy.
```
