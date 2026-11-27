// Pure helpers shared by assemble.mjs (command line) and the compare page's "Finalize selected" button.
// compare.mjs inlines these functions into the page with Function.prototype.toString, so each one must be
// self-contained: no imports, no references to anything outside its own body.

export function buildFinal({ app, specs, picks, inventory, date, base }) {
  const DENS = ['dense', 'standard', 'roomy'];
  const files = [];
  const rows = [];
  for (const sc0 of specs) {
    const d = picks[sc0.id];
    if (!DENS.includes(d)) throw new Error('no density picked for ' + sc0.id);
    const sc = Object.assign({}, sc0, { density: d });
    files.push({ path: 'specs/screens/' + sc.id + '.json', text: JSON.stringify(sc, null, 2) + '\n' });
    const states = Object.keys(sc.states || {});
    rows.push({
      id: sc.id, title: sc.title, density: d, serves: sc.serves || [], edge: sc.edge || [],
      states: states.length ? states.map((k) => ({ key: k, label: (sc.states[k] && sc.states[k].label) || k })) : [{ key: 'default', label: 'Default' }],
      notes: (sc.notes || []).concat(states.reduce((a, k) => a.concat((sc.states[k] && sc.states[k].notes) || []), [])),
      spec: 'specs/screens/' + sc.id + '.json', preview: 'html/' + sc.id + '.html',
    });
  }
  files.push({ path: 'specs/app.json', text: JSON.stringify(app, null, 2) + '\n' });
  if (inventory) files.push({ path: 'inventory.md', text: inventory });
  files.push({ path: 'SELECTION.json', text: JSON.stringify({ chosen: date, densities: Object.fromEntries(rows.map((x) => [x.id, x.density])) }, null, 2) + '\n' });
  files.push({ path: 'manifest.json', text: JSON.stringify({ app: app.name, chosen: date, nav: app.nav || [], screens: rows }, null, 2) + '\n' });
  const readme = '# Selected wireframes: ' + (app.name || 'App') + '\n\n'
    + 'Chosen ' + date + '. **This folder is the source of truth for the UI.** Build the product\'s screens from these; do not redesign them. Anything a wireframe leaves as `[TBD]` is undecided.\n\n'
    + 'How to read it\n'
    + '- `specs/screens/SCR-*.json` is the structure of each screen: layout, components, states. The vocabulary is documented in the wireframe skill\'s `references/kit.md`.\n'
    + '- `html/SCR-*.html` is the same screen rendered. Open one in a browser; the bar at the bottom switches state, viewport and density. Screens link to each other through their nav.\n'
    + '- `density` is the spacing level chosen for that screen (dense, standard or roomy).\n'
    + '- FR and EC ids refer to the project\'s REQUIREMENTS.md.\n'
    + '- `inventory.md` lists the screens, their states and the shared sample data. `manifest.json` is the table below in machine-readable form.\n\n'
    + '| Screen | Title | Density | Requirements | Edge cases | States | Spec |\n|---|---|---|---|---|---|---|\n'
    + rows.map((x) => '| ' + x.id + ' | ' + x.title + ' | ' + x.density + ' | ' + (x.serves.join(', ') || '-') + ' | ' + (x.edge.join(', ') || '-') + ' | ' + x.states.map((s) => s.key).join(', ') + ' | [json](' + x.spec + ') |').join('\n')
    + '\n\nBehavior notes (what a picture cannot show)\n'
    + (rows.filter((x) => x.notes.length).map((x) => '- **' + x.id + '**: ' + x.notes.join('; ')).join('\n') || '- none') + '\n';
  files.push({ path: 'README.md', text: readme });
  const block = '<!-- wireframes:begin -->\n## UI mockups\n\n'
    + 'Approved UI mockups for this app are saved in `' + base + '/final/`. **Refer to them whenever you create or change the UI.** Build each screen from its spec in `' + base + '/final/specs/screens/` (structure, components, states) and open `' + base + '/final/html/<screen>.html` to see it. Do not redesign them. Start with `' + base + '/final/README.md`.\n\n'
    + '| Screen | Requirements | Density |\n|---|---|---|\n'
    + rows.map((x) => '| ' + x.id + ' ' + x.title + ' | ' + (x.serves.join(', ') || '-') + ' | ' + x.density + ' |').join('\n')
    + '\n<!-- wireframes:end -->\n';
  return { files, rows, block };
}

export function applyBlock(text, block) {
  const a = text.indexOf('<!-- wireframes:begin -->');
  const b = text.indexOf('<!-- wireframes:end -->');
  if (a >= 0 && b > a) return text.slice(0, a) + block.trim() + text.slice(b + '<!-- wireframes:end -->'.length);
  return text.replace(/\s*$/, '') + '\n\n' + block;
}
