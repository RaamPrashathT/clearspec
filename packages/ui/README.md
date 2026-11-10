# @clearspec/ui

Shared React + shadcn/ui views and components: setup, run timeline, question picker, preview pane. Both `apps/cli` and `apps/web` build from this package, replacing the two copied UIs in the old repo.

## Carry-over notes

- The preview pane must load mockups in a sandboxed iframe (`sandbox="allow-scripts"`, never with `allow-same-origin`), served from a separate origin in the web app.
- Real routes for runs instead of hash routing.
- Download a spec as a zip.
