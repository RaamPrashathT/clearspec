#!/usr/bin/env node
// Command-line twin of the compare page's "Finalize selected" button.
// Usage: node assemble.mjs <wireframesDir> <selection.json | '{"SCR-x":"dense",...}'> [--default dense|standard|roomy]
//   selection maps screen id -> density. A screen without a pick uses --default, else it is an error.
// Writes <wireframesDir>/final/ and appends a "UI mockups" section to the requirements file named in
// <wireframesDir>/source.json ({ "requirements": "path/relative/to/the/project/root" }).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildFinal, applyBlock } from './lib-final.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const di = argv.indexOf('--default');
const def = di >= 0 ? argv.splice(di, 2)[1] : null;
const [root = 'wireframes', selArg] = argv;
const DENS = ['dense', 'standard', 'roomy'];
if (!selArg) { console.log('usage: assemble.mjs <wireframesDir> <selection.json|json> [--default <density>]'); process.exit(1); }
if (def && !DENS.includes(def)) { console.log(`ERROR --default must be one of ${DENS.join(', ')}`); process.exit(1); }
const sel = JSON.parse(fs.existsSync(selArg) ? fs.readFileSync(selArg, 'utf8') : selArg);
const rootAbs = path.resolve(root);
const specs = path.join(rootAbs, 'specs');
const sd = path.join(specs, 'screens');
const final = path.join(rootAbs, 'final');
const base = path.relative(process.cwd(), rootAbs).split(path.sep).join('/');
const projectRoot = process.cwd();
const screens = fs.readdirSync(sd).filter((f) => f.endsWith('.json')).sort().map((f) => JSON.parse(fs.readFileSync(path.join(sd, f), 'utf8')));
const picks = {};
let bad = 0;
for (const s of screens) {
  const d = sel[s.id] || def;
  if (!DENS.includes(d)) { console.log(`ERROR ${s.id}: no valid pick (got ${JSON.stringify(sel[s.id])})`); bad++; } else picks[s.id] = d;
}
if (bad) process.exit(1);

const app = JSON.parse(fs.readFileSync(path.join(specs, 'app.json'), 'utf8'));
const invFile = path.join(rootAbs, 'inventory.md');
const res = buildFinal({ app, specs: screens, picks, inventory: fs.existsSync(invFile) ? fs.readFileSync(invFile, 'utf8') : '', date: new Date().toISOString().slice(0, 10), base });
fs.rmSync(final, { recursive: true, force: true });
for (const f of res.files) { const p = path.join(final, f.path); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, f.text); }
const r = spawnSync(process.execPath, [path.join(here, 'render.mjs'), path.join(final, 'specs'), path.join(final, 'html'), '--no-kit'], { encoding: 'utf8' });
process.stdout.write(r.stdout);

let msg = `assemble: ${screens.length} screens saved to ${final}/`;
const srcFile = path.join(rootAbs, 'source.json');
let src = fs.existsSync(srcFile) ? JSON.parse(fs.readFileSync(srcFile, 'utf8')) : null;
if (!src && fs.existsSync(path.join(rootAbs, '..', 'REQUIREMENTS.md'))) src = { requirements: path.relative(projectRoot, path.join(rootAbs, '..', 'REQUIREMENTS.md')).split(path.sep).join('/') };
if (src?.requirements) {
  const reqPath = path.resolve(projectRoot, src.requirements);
  if (fs.existsSync(reqPath)) { fs.writeFileSync(reqPath, applyBlock(fs.readFileSync(reqPath, 'utf8'), res.block)); msg += `; added a "UI mockups" section to ${src.requirements}`; }
  else msg += `; requirements file ${src.requirements} not found, nothing appended`;
} else msg += '; no requirements file recorded in source.json, nothing appended';
console.log(msg);
process.exit(r.status || 0);
