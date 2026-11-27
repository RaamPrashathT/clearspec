#!/usr/bin/env node
// Wireframe renderer v1: screen specs (JSON) -> self-contained HTML files. No dependencies.
// Usage: node render.mjs <specsDir> <outDir> [--app <app.json>] [--no-kit] [--density dense|standard|roomy]
// A screen spec may set "density"; otherwise --density (default standard) applies.
//   <specsDir>/app.json            optional: { name, user:{name,sub}, nav:[{label,screen}] }
//   <specsDir>/screens/*.json      one file per screen
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const CSS = fs.readFileSync(path.join(here, '../../assets/wireframe/kit.css'), 'utf8');
const argv = process.argv.slice(2);
const flag = (name) => { const i = argv.indexOf(name); if (i < 0) return null; const v = argv[i + 1]; argv.splice(i, v && !v.startsWith('--') ? 2 : 1); return v && !v.startsWith('--') ? v : true; };
const APP_PATH = flag('--app');
const NO_KIT = flag('--no-kit') === true;
const DENSITIES = ['dense', 'standard', 'roomy'];
const DEFAULT_DENSITY = (() => { const d = flag('--density'); return typeof d === 'string' && DENSITIES.includes(d) ? d : 'standard'; })();
const [specsDir = 'specs', outDir = 'mockups'] = argv;

const errors = [];
const warnings = [];
const err = (m) => { if (!errors.includes(m)) errors.push(m); };
const warn = (m) => { if (!warnings.includes(m)) warnings.push(m); };
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
let uidN = 0;
const uid = () => `f${++uidN}`;
const oneOf = (v, list, p, what) => {
  if (list.includes(v)) return v;
  err(`${p}: ${what} "${v}" is not one of ${list.join(', ')}`);
  return list[0];
};

/* ---------- icons ---------- */
const ICONS = {
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
  'external-link': '<path d="M14 4h6v6"/><path d="M20 4l-9.5 9.5"/><path d="M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10"/>',
  copy: '<rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2.2"/><path d="M15.5 8.5V6.2A2.2 2.2 0 0 0 13.3 4H6.2A2.2 2.2 0 0 0 4 6.2v7.1a2.2 2.2 0 0 0 2.2 2.2h2.3"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  minus: '<path d="M6 12h12"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  'chevron-down': '<path d="M6 9l6 6 6-6"/>',
  'chevron-up': '<path d="M6 15l6-6 6 6"/>',
  'chevron-left': '<path d="M15 6l-6 6 6 6"/>',
  'chevron-right': '<path d="M9 6l6 6-6 6"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  user: '<circle cx="12" cy="8" r="3.8"/><path d="M4.5 20c.6-3.8 3.8-5.8 7.5-5.8s6.9 2 7.5 5.8"/>',
  settings: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  trash: '<path d="M4 7h16M10 7V4.5h4V7M6.5 7l.8 12.5h9.4L17.5 7"/>',
  edit: '<path d="M4 20l1-4L16 5a2.1 2.1 0 0 1 3 3L8 19z"/>',
  more: '<circle cx="5.5" cy="12" r="1.1"/><circle cx="12" cy="12" r="1.1"/><circle cx="18.5" cy="12" r="1.1"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8v.1"/>',
  alert: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17v.1"/>',
  calendar: '<rect x="4" y="5.5" width="16" height="14.5" rx="2"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
  'arrow-right': '<path d="M5 12h14M13 6l6 6-6 6"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
  image: '<rect x="4" y="5" width="16" height="14" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="M4 17l5-4.5 4 3.5 3-2.5 4 3.5"/>',
  mail: '<rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="M4 7.5l8 6 8-6"/>',
  lock: '<rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
};
export const ICON_NAMES = Object.keys(ICONS);
const ico = (name, size = 16, p = '') => {
  if (!ICONS[name]) {
    err(`${p}: unknown icon "${name}" (known: ${ICON_NAMES.join(', ')})`);
    return '';
  }
  return `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
};

/* ---------- node rendering ---------- */
let SCREEN_IDS = null; // null = don't validate links (gallery)
const href = (to, p) => {
  if (!to) return null;
  if (SCREEN_IDS && !SCREEN_IDS.has(to)) err(`${p}: "to" points at unknown screen "${to}"`);
  return `${to}.html`;
};
const AL = { start: 'flex-start', center: 'center', end: 'flex-end', stretch: 'stretch', between: 'space-between' };
const sty = (o) => Object.entries(o).filter(([, v]) => v != null).map(([k, v]) => `${k}:${v}`).join(';');

function R(n, p) {
  if (n == null) return '';
  if (typeof n === 'string' || typeof n === 'number') return esc(n);
  if (Array.isArray(n)) return n.map((c, i) => R(c, `${p}[${i}]`)).join('');
  const f = T[n.type];
  if (!f) {
    err(`${p}: unknown type "${n.type}". Known: ${Object.keys(T).join(', ')}`);
    return `<div class="alert danger">unknown type: ${esc(n.type)}</div>`;
  }
  return f(n, `${p}(${n.type})`);
}
const kids = (n, p) => R(n.children || [], `${p}.children`);
const need = (n, p, ...keys) => keys.forEach((k) => n[k] == null && err(`${p}: missing "${k}"`));

const field = (n, ctl, id) =>
  `<div class="field"${n.width ? ` style="max-width:${esc(n.width)}"` : ''}>${n.label ? `<label class="lbl" for="${id}">${esc(n.label)}${n.required ? '<span class="req">*</span>' : ''}</label>` : ''}${ctl}${
    n.error ? `<div class="help err">${ico('alert', 14)}${esc(n.error)}</div>` : n.help ? `<div class="help">${esc(n.help)}</div>` : ''
  }</div>`;

const initials = (name) => String(name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
const hash = (s) => [...String(s)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
const avatar = (name, size = 'md') => `<span class="av t${hash(name) % 3} ${size === 'md' ? '' : size}" title="${esc(name)}">${esc(initials(name))}</span>`;

const GLYPH = { done: 'check', backfilled: 'check', missed: 'minus' };
const STATUSES = ['done', 'backfilled', 'missed', 'todo', 'future'];
const cell = (s, p, today) => {
  oneOf(s, STATUSES, p, 'cell status');
  return `<span class="cell ${s}${today ? ' today' : ''}">${GLYPH[s] ? ico(GLYPH[s], 15) : ''}</span>`;
};
const LEGEND = { done: 'On time', backfilled: 'Back-filled', missed: 'Missed', todo: 'Not yet ticked', future: 'Not yet due' };

const T = {
  /* layout */
  stack: (n, p) => `<div class="stack" style="${sty({ '--g': n.gap ?? 3, 'align-items': AL[n.align] })}">${kids(n, p)}</div>`,
  row: (n, p) => `<div class="row${n.wrap ? ' wrap' : ''}" style="${sty({ '--g': n.gap ?? 3, 'align-items': AL[n.align], 'justify-content': AL[n.justify] })}">${kids(n, p)}</div>`,
  grid: (n, p) => {
    const c = typeof n.cols === 'number' ? { mobile: 1, tablet: Math.min(n.cols, 2), desktop: n.cols } : { mobile: 1, tablet: 2, desktop: 3, ...(n.cols || {}) };
    return `<div class="grid" style="--cm:${c.mobile};--ct:${c.tablet};--cd:${c.desktop};--g:${n.gap ?? 4}">${kids(n, p)}</div>`;
  },
  divider: () => '<hr class="div">',
  spacer: (n) => `<div style="height:${(n.size ?? 4) * 4}px"></div>`,

  /* text */
  heading: (n, p) => {
    need(n, p, 'text');
    const l = oneOf(String(n.level || 1), ['1', '2', '3'], p, 'level');
    const h = `<h${l} class="h${l}">${esc(n.text)}</h${l}>${n.sub ? `<p class="sub">${esc(n.sub)}</p>` : ''}`;
    return n.actions ? `<div class="ph"><div>${h}</div><div class="row" style="--g:2">${R(n.actions, `${p}.actions`)}</div></div>` : `<div>${h}</div>`;
  },
  text: (n, p) => {
    need(n, p, 'text');
    return `<p class="tx${n.muted ? ' muted' : ''}${n.size ? ` ${oneOf(n.size, ['sm', 'lg'], p, 'size')}` : ''}${n.strong ? ' strong' : ''}">${esc(n.text)}</p>`;
  },
  link: (n, p) => {
    need(n, p, 'label');
    return `<a class="link" href="${href(n.to, p) || '#'}">${esc(n.label)}${n.external ? ico('external-link', 14, p) : ''}</a>`;
  },
  icon: (n, p) => ico(n.name, n.size || 16, p),

  /* controls */
  button: (n, p) => {
    if (!n.label && !n.icon) err(`${p}: needs "label" or "icon"`);
    const v = oneOf(n.variant || 'secondary', ['primary', 'secondary', 'ghost', 'danger'], p, 'variant');
    const sz = oneOf(n.size || 'md', ['sm', 'md', 'lg'], p, 'size');
    const inner = `${n.icon ? ico(n.icon, 16, p) : ''}${n.label ? `<span>${esc(n.label)}</span>` : ''}${n.iconRight ? ico(n.iconRight, 16, p) : ''}`;
    const cls = `btn btn-${v} btn-${sz}${n.label ? '' : ' btn-icon'}${n.full ? ' btn-full' : ''}`;
    const h = href(n.to, p);
    const aria = n.label ? '' : ` aria-label="${esc(n.icon)}"`;
    return h ? `<a class="${cls}" href="${h}"${aria}>${inner}</a>` : `<button type="button" class="${cls}"${n.disabled ? ' disabled' : ''}${aria}>${inner}</button>`;
  },
  input: (n, p) => {
    const id = uid();
    const ctl = `<div class="ctl${n.error ? ' bad' : ''}${n.disabled ? ' dis' : ''}">${n.icon ? ico(n.icon, 16, p) : ''}<input id="${id}" type="${esc(n.inputType || 'text')}" placeholder="${esc(n.placeholder)}" value="${esc(n.value)}"${n.disabled ? ' disabled' : ''}>${n.suffix ? `<span class="sfx">${esc(n.suffix)}</span>` : ''}${
      n.iconRight ? `<button type="button" class="ib" aria-label="${esc(n.iconRight)}">${ico(n.iconRight, 16, p)}</button>` : ''
    }</div>`;
    return field(n, ctl, id);
  },
  textarea: (n, p) => {
    const id = uid();
    return field(n, `<div class="ctl area${n.error ? ' bad' : ''}"><textarea id="${id}" rows="${n.rows || 3}" placeholder="${esc(n.placeholder)}">${esc(n.value)}</textarea></div>`, id);
  },
  select: (n, p) => {
    const id = uid();
    const opts = (n.options || []).map((o) => (typeof o === 'string' ? { label: o, value: o } : { value: o.label, ...o }));
    if (!opts.length) err(`${p}: needs "options"`);
    const ctl = `<div class="ctl${n.error ? ' bad' : ''}${n.disabled ? ' dis' : ''}"><select id="${id}"${n.disabled ? ' disabled' : ''}>${opts.map((o) => `<option${(n.value ?? opts[0]?.value) === o.value ? ' selected' : ''}>${esc(o.label)}</option>`).join('')}</select>${ico('chevron-down', 16, p)}</div>`;
    return field(n, ctl, id);
  },
  checkbox: (n, p) => {
    need(n, p, 'label');
    return `<label class="chk${n.emphasis ? ' em' : ''}"><input type="checkbox"${n.checked ? ' checked' : ''}${n.indeterminate ? ' class="indet"' : ''}${n.disabled ? ' disabled' : ''}><span><b>${esc(n.label)}</b>${n.help ? `<small>${esc(n.help)}</small>` : ''}</span></label>`;
  },
  radio: (n, p) => {
    need(n, p, 'label');
    return `<label class="chk"><input type="radio" name="${esc(n.name || 'r')}"${n.checked ? ' checked' : ''}${n.disabled ? ' disabled' : ''}><span><b>${esc(n.label)}</b>${n.help ? `<small>${esc(n.help)}</small>` : ''}</span></label>`;
  },
  toggle: (n, p) => {
    need(n, p, 'label');
    return `<label class="chk"><input type="checkbox" class="sw"${n.on ? ' checked' : ''}><span><b>${esc(n.label)}</b>${n.help ? `<small>${esc(n.help)}</small>` : ''}</span></label>`;
  },
  dropdown: (n, p) => {
    const items = (n.items || []).map((it) => (it.divider ? '<hr>' : `<div class="mi${it.danger ? ' danger' : ''}">${it.icon ? ico(it.icon, 16, p) : '<span class="ic0"></span>'}<span>${esc(it.label)}</span>${it.checked ? ico('check', 16, p) : ''}${it.hint ? `<kbd>${esc(it.hint)}</kbd>` : ''}</div>`)).join('');
    if (!items) err(`${p}: needs "items"`);
    const trigger = R({ type: 'button', label: n.label, icon: n.icon, variant: n.variant || 'secondary', size: n.size, iconRight: n.label ? 'chevron-down' : undefined }, p);
    return `<div class="dd${n.reserve ? ' reserve' : ''}"><div data-dd>${trigger}</div><div class="menu${n.align === 'end' ? ' end' : ''}"${n.open ? '' : ' hidden'}>${items}</div></div>`;
  },

  /* display */
  badge: (n, p) => {
    need(n, p, 'label');
    const t = oneOf(n.tone || 'neutral', ['neutral', 'solid', 'outline', 'dashed', 'success', 'danger', 'warning', 'info'], p, 'tone');
    const dot = ['success', 'danger', 'warning'].includes(t) && n.dot !== false ? '<i class="dot"></i>' : '';
    return `<span class="badge ${t}">${dot}${n.icon ? ico(n.icon, 12, p) : ''}${esc(n.label)}</span>`;
  },
  avatar: (n, p) => (need(n, p, 'name'), avatar(n.name, oneOf(n.size || 'md', ['sm', 'md', 'lg'], p, 'size'))),
  'avatar-group': (n, p) => {
    const names = n.names || [];
    const max = n.max ?? 4;
    return `<span class="avg">${names.slice(0, max).map((x) => avatar(x, n.size || 'md')).join('')}${names.length > max ? `<span class="av ${n.size && n.size !== 'md' ? n.size : ''}">+${names.length - max}</span>` : ''}</span>`;
  },
  person: (n, p) => (need(n, p, 'name'), `<div class="person">${avatar(n.name, n.size || 'md')}<div class="pn"><b>${esc(n.name)}</b>${n.sub ? `<span>${esc(n.sub)}</span>` : ''}</div></div>`),
  card: (n, p) => {
    const head = n.title || n.description || n.actions
      ? `<div class="card-h"><div>${n.title ? `<div class="card-t">${esc(n.title)}</div>` : ''}${n.description ? `<div class="card-d">${esc(n.description)}</div>` : ''}</div>${n.actions ? `<div class="row" style="--g:2">${R(n.actions, `${p}.actions`)}</div>` : ''}</div>` : '';
    const body = n.children ? `<div class="card-b"><div class="stack" style="--g:${n.gap ?? 4}">${kids(n, p)}</div></div>` : '';
    const foot = n.footer ? `<div class="card-f">${R(n.footer, `${p}.footer`)}</div>` : '';
    return `<section class="card${n.flush ? ' flush' : ''}${n.emphasis ? ' em' : ''}">${head}${body}${foot}</section>`;
  },
  accordion: (n, p) => {
    const items = n.items || [];
    if (!items.length) err(`${p}: needs "items"`);
    return `<div class="acc">${items.map((it, i) => `<details${it.open ? ' open' : ''}><summary><span>${esc(it.title)}</span>${ico('chevron-down', 18, p)}</summary><div class="acc-b"><div class="stack" style="--g:3">${R(it.children || [], `${p}.items[${i}].children`)}</div></div></details>`).join('')}</div>`;
  },
  tabs: (n, p) => `<div class="tabs">${(n.items || []).map((t) => `<span class="tab${t.active ? ' on' : ''}">${esc(t.label)}${t.badge != null ? R({ type: 'badge', label: String(t.badge) }, p) : ''}</span>`).join('')}</div>`,
  alert: (n, p) => {
    const t = oneOf(n.tone || 'info', ['info', 'success', 'warning', 'danger'], p, 'tone');
    const ic = { info: 'info', success: 'check', warning: 'alert', danger: 'alert' }[t];
    return `<div class="alert ${t}" role="alert">${ico(ic, 18, p)}<div>${n.title ? `<b>${esc(n.title)}</b>` : ''}${n.text ? `<p>${esc(n.text)}</p>` : ''}</div></div>`;
  },
  empty: (n, p) => (need(n, p, 'title'), `<div class="empty"><span class="eic">${ico(n.icon || 'image', 22, p)}</span><b>${esc(n.title)}</b>${n.text ? `<p>${esc(n.text)}</p>` : ''}${n.action ? R(n.action, `${p}.action`) : ''}</div>`),
  stat: (n, p) => (need(n, p, 'label', 'value'), `<div class="stat"><span class="sl">${esc(n.label)}</span><span class="sv">${esc(n.value)}</span>${n.hint ? `<span class="sh">${esc(n.hint)}</span>` : ''}</div>`),
  skeleton: (n) => `<div class="sk">${'<i></i>'.repeat(n.lines || 3)}</div>`,
  progress: (n, p) => {
    const pct = Math.max(0, Math.min(100, Math.round(((n.value ?? 0) / (n.max ?? 100)) * 100)));
    return `<div class="prog">${n.label ? `<div class="pl"><span>${esc(n.label)}</span><span>${pct}%</span></div>` : ''}<div class="pt"><i style="width:${pct}%"></i></div></div>`;
  },
  'status-strip': (n, p) => `<span class="strip">${(n.cells || []).map((c, i) => cell(c, `${p}.cells[${i}]`, n.today === i)).join('')}</span>`,
  'status-grid': (n, p) => {
    const days = n.days || ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    const rows = n.rows || [];
    const hasMeta = rows.some((r) => r.meta);
    const head = `<div class="sg-head"><span class="sg-spacer"></span>${days.map((d) => `<span>${esc(d)}</span>`).join('')}<span class="sg-spacer2"></span></div>`;
    const body = rows.map((r, ri) => `<div class="sg-row"><div class="sg-lab"><div class="sg-top"><b>${esc(r.label)}</b>${r.aside ? `<span class="sg-aside">${esc(r.aside)}</span>` : ''}</div>${r.sub ? `<span class="sg-sub">${esc(r.sub)}</span>` : ''}</div>${(r.cells || []).map((c, i) => cell(c, `${p}.rows[${ri}].cells[${i}]`, n.today === i)).join('')}${r.meta ? `<div class="sg-meta">${R(r.meta, `${p}.rows[${ri}].meta`)}</div>` : hasMeta ? '<div></div>' : ''}</div>`).join('');
    const legend = n.legend ? `<div class="legend">${STATUSES.map((s) => `<span>${cell(s, p)}${LEGEND[s]}</span>`).join('')}</div>` : '';
    const emph = hasMeta && JSON.stringify(rows.map((r) => r.meta)).includes('"emphasis":true');
    return `<div class="sg" style="${hasMeta ? `--meta:${n.metaWidth || (emph ? '250px' : '150px')}` : ''}">${head}${body}${legend}</div>`;
  },
  table: (n, p) => {
    const cols = n.columns || [];
    if (!cols.length) err(`${p}: needs "columns"`);
    const rows = n.rows || [];
    const al = (c) => (c.align === 'right' ? ' r num' : c.align === 'center' ? ' c' : '');
    const head = `<tr>${n.selectable ? '<th class="selc"><label class="chk"><input type="checkbox"></label></th>' : ''}${cols.map((c) => `<th class="${al(c).trim()}"${c.width ? ` style="width:${esc(c.width)}"` : ''}>${esc(c.label)}</th>`).join('')}${n.rowActions ? '<th class="actc"></th>' : ''}</tr>`;
    const cellHtml = (v, pp) => (v == null || v === '' ? '<span class="mute">&mdash;</span>' : R(v, pp));
    const body = rows.length
      ? rows.map((r, ri) => `<tr${r._selected ? ' class="sel"' : ''}>${n.selectable ? `<td class="selc"><label class="chk"><input type="checkbox"${r._selected ? ' checked' : ''}></label></td>` : ''}${cols.map((c, ci) => `<td class="${(al(c) + (ci === 0 ? ' first' : '')).trim()}" data-label="${esc(c.label)}">${cellHtml(r[c.key], `${p}.rows[${ri}].${c.key}`)}</td>`).join('')}${n.rowActions ? `<td class="actc">${R({ type: 'button', icon: 'more', variant: 'ghost', size: 'sm' }, p)}</td>` : ''}</tr>`).join('')
      : `<tr><td colspan="${cols.length + (n.selectable ? 1 : 0) + (n.rowActions ? 1 : 0)}" class="c">${esc(n.emptyText || 'No rows')}</td></tr>`;
    const tb = n.toolbar
      ? `<div class="tb"><div>${n.toolbar.title ? `<div class="card-t">${esc(n.toolbar.title)}</div>` : ''}</div><div class="tb-r">${n.toolbar.search ? R({ type: 'input', icon: 'search', placeholder: n.toolbar.search === true ? 'Search' : n.toolbar.search }, p) : ''}${R(n.toolbar.actions || [], `${p}.toolbar.actions`)}</div></div>` : '';
    const foot = n.footer ? `<div class="tf"><span>${esc(n.footer)}</span>${n.pager ? `<div class="row" style="--g:1">${R([{ type: 'button', icon: 'chevron-left', variant: 'ghost', size: 'sm' }, { type: 'button', icon: 'chevron-right', variant: 'ghost', size: 'sm' }], p)}</div>` : ''}</div>` : '';
    return `<div class="tbl-wrap">${tb}<div class="tbl-scroll"><table class="tbl"><thead>${head}</thead><tbody>${body}</tbody></table></div>${foot}</div>`;
  },
  dialog: (n, p) => {
    need(n, p, 'title');
    const d = `<div class="dialog${n.static ? ' static' : ''}" role="dialog" aria-label="${esc(n.title)}"><div class="dlg-h"><div><div class="dlg-t">${esc(n.title)}</div>${n.description ? `<div class="dlg-d">${esc(n.description)}</div>` : ''}</div>${R({ type: 'button', icon: 'x', variant: 'ghost', size: 'sm' }, p)}</div>${n.children ? `<div class="dlg-b"><div class="stack" style="--g:4">${kids(n, p)}</div></div>` : ''}${n.actions ? `<div class="dlg-f">${R(n.actions, `${p}.actions`)}</div>` : ''}</div>`;
    return n.static ? d : `<div class="scrim">${d}</div>`;
  },
  toast: (n, p) => (need(n, p, 'text'), `<div class="toast">${ico(n.icon || 'check', 16, p)}${esc(n.text)}</div>`),
};

/* ---------- screens ---------- */
const VPS = [['mobile', 'Mobile'], ['tablet', 'Tablet'], ['desktop', 'Desktop']];

function shell(app, sc, p) {
  const active = sc.activeNav || sc.id;
  const nav = (app.nav || []).map((i) => `<a class="nl${i.screen === active ? ' on' : ''}" href="${href(i.screen, `app.json nav "${i.label}"`)}">${esc(i.label)}</a>`).join('');
  const user = app.user ? `<div class="user">${avatar(app.user.name, 'sm')}<span class="un">${esc(app.user.name)}</span></div>` : '';
  return `<header class="appbar"><div class="brand"><span class="logo"></span>${esc(app.name || 'App')}</div><nav>${nav}</nav>${user}</header>`;
}

function renderScreen(sc, app) {
  const p = sc.id;
  const density = DENSITIES.includes(sc.density) ? sc.density : DEFAULT_DENSITY;
  if (sc.density && !DENSITIES.includes(sc.density)) err(`${p}: density "${sc.density}" is not one of ${DENSITIES.join(', ')}`);
  const states = sc.states && Object.keys(sc.states).length ? sc.states : { default: { label: 'Default' } };
  const keys = Object.keys(states);
  const def = sc.default && states[sc.default] ? sc.default : keys[0];
  if (sc.default && !states[sc.default]) err(`${p}: "default" state "${sc.default}" does not exist`);
  if (!sc.serves?.length && sc.id !== '_kit') warn(`${p}: "serves" is empty (list the FR ids this screen covers)`);
  const bare = sc.shell === 'none';
  const hid = (k) => (k === def ? '' : ' hidden');
  const main = keys.map((k) => {
    const s = states[k];
    const body = s.body ?? sc.body;
    if (body == null) warn(`${p}.states.${k}: no body (state or screen level)`);
    return `<section class="state" data-state="${esc(k)}"${hid(k)}>${R(body || [], `${p}.states.${k}.body`)}</section>`;
  }).join('');
  const overlays = keys.filter((k) => states[k].overlay).map((k) => `<div class="ov" data-state="${esc(k)}"${hid(k)}>${R(states[k].overlay, `${p}.states.${k}.overlay`)}</div>`).join('');
  const tags = [...(sc.serves || []).map((x) => `<span class="tag">${esc(x)}</span>`), ...(sc.edge || []).map((x) => `<span class="tag ec">${esc(x)}</span>`)].join('');
  const notes = [...(sc.notes || []).map((x) => `<li>${esc(x)}</li>`), ...keys.flatMap((k) => (states[k].notes || []).map((x) => `<li><b>${esc(states[k].label || k)}:</b> ${esc(x)}</li>`))].join('');
  const stateBtns = keys.length > 1 ? `<div class="seg"><span>State</span>${keys.map((k) => `<button type="button" data-s="${esc(k)}" aria-pressed="${k === def}">${esc(states[k].label || k)}</button>`).join('')}</div>` : '';
  const content = `<main class="content${bare && sc.layout !== 'wide' ? ' center' : ''}">${main}</main>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(sc.title)} · ${esc(app.name || 'Wireframe')}</title><style>${CSS}</style></head>
<body data-vp="desktop" data-density="${density}">
<div class="page">
<div class="meta"><span class="mid">${esc(sc.id)}</span><h1>${esc(sc.title)}</h1><div class="tags">${tags}</div></div>
<div class="stage"><div class="frame">${bare ? '' : shell(app, sc, p)}${content}${overlays}</div></div>
${notes ? `<aside class="notes" hidden><h2>Notes</h2><ul>${notes}</ul></aside>` : ''}
</div>
<div class="bar">${stateBtns}<div class="seg"><span>View</span>${VPS.map(([k, l]) => `<button type="button" data-v="${k}" aria-pressed="${k === 'desktop'}">${l}</button>`).join('')}</div><div class="seg"><span>Density</span>${DENSITIES.map((k) => `<button type="button" data-d="${k}" aria-pressed="${k === density}">${k[0].toUpperCase() + k.slice(1)}</button>`).join('')}</div>${notes ? '<div class="seg"><button type="button" data-notes aria-pressed="false">Notes</button></div>' : ''}</div>
<script>${CLIENT_JS}</script>
</body></html>`;
}

const CLIENT_JS = `(()=>{const $=(s)=>[...document.querySelectorAll(s)],q=new URLSearchParams(location.search),b=document.body,DS=['dense','standard','roomy'];
const report=()=>{if(window.parent===window)return;const f=document.querySelector('.frame');if(f)parent.postMessage({wfh:Math.round(f.offsetHeight)},'*')};
const sync=()=>{if(b.classList.contains('embed'))return;const u=new URLSearchParams();const s=$('[data-s][aria-pressed="true"]')[0];if(s)u.set('state',s.dataset.s);u.set('view',b.dataset.vp);u.set('density',b.dataset.density);history.replaceState(null,'','?'+u)};
const press=(sel,val,attr)=>$(sel).forEach(x=>x.setAttribute('aria-pressed',String(x.dataset[attr]===val)));
const setState=(k)=>{$('[data-state]').forEach(e=>e.hidden=e.dataset.state!==k);press('[data-s]',k,'s');$('.dd .menu').forEach(m=>m.hidden=true);report()};
const setView=(v)=>{b.dataset.vp=v;press('[data-v]',v,'v');report()};
const setDensity=(d)=>{if(!DS.includes(d))return;b.dataset.density=d;press('[data-d]',d,'d');report()};
document.addEventListener('click',e=>{const t=e.target.closest('button,[data-dd]');
 if(t&&t.dataset.s){setState(t.dataset.s);sync();return}
 if(t&&t.dataset.v){setView(t.dataset.v);sync();return}
 if(t&&t.dataset.d){setDensity(t.dataset.d);sync();return}
 if(t&&t.hasAttribute('data-notes')){const n=document.querySelector('.notes');n.hidden=!n.hidden;t.setAttribute('aria-pressed',String(!n.hidden));return}
 const d=e.target.closest('[data-dd]');$('.dd .menu').forEach(m=>{if(d&&m.previousElementSibling===d)m.hidden=!m.hidden;else m.hidden=true});});
addEventListener('message',e=>{const d=e.data;if(!d||!d.wf)return;if(d.embed)b.classList.add('embed');if(d.view)setView(d.view);if(d.density)setDensity(d.density);if(d.state&&$('[data-state="'+d.state+'"]').length)setState(d.state);report()});
if(q.get('embed'))b.classList.add('embed');const s=q.get('state');if(s&&$('[data-state="'+s+'"]').length)setState(s);if(['mobile','tablet','desktop'].includes(q.get('view')))setView(q.get('view'));setDensity(q.get('density'));
})();`;



/* ---------- design lint: objective layout rules, so the AI fixes them before a human sees them ---------- */
const FIELD = new Set(['input', 'select', 'textarea']);
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
const wordCount = (s) => String(s || '').trim().split(/s+/).filter(Boolean).length;
const kidsOf = (n) => [...(n.children || []), ...(n.actions || []), ...(n.footer || []), ...(n.items || []).flatMap((i) => i.children || []), ...(n.rows && n.type === 'status-grid' ? n.rows.map((r) => r.meta).filter(Boolean) : [])];
function walk(n, f, ctx = {}) {
  if (Array.isArray(n)) return n.forEach((x) => walk(x, f, ctx));
  if (!n || typeof n !== 'object' || !n.type) return;
  f(n, ctx);
  let c = ctx;
  if (n.type === 'card') c = { ...ctx, card: n };
  if (n.type === 'grid') c = { ...ctx, gridCols: typeof n.cols === 'number' ? n.cols : n.cols?.desktop ?? 3 };
  kidsOf(n).forEach((x) => walk(x, f, c));
}
function est(n) {
  if (Array.isArray(n)) return n.reduce((a, x) => a + est(x) + 16, 0);
  if (!n || typeof n !== 'object') return 0;
  switch (n.type) {
    case 'heading': return 40 + (n.sub ? 22 : 0);
    case 'card': return (n.title ? 44 : 0) + (n.description ? 20 : 0) + 30 + est(n.children || []) + (n.footer ? 52 : 0);
    case 'stack': return est(n.children || []);
    case 'row': return Math.max(36, ...(n.children || []).map(est));
    case 'grid': {
      const cols = typeof n.cols === 'number' ? n.cols : n.cols?.desktop ?? 3;
      const k = n.children || [];
      let t = 0;
      for (let i = 0; i < k.length; i += cols) t += Math.max(0, ...k.slice(i, i + cols).map(est)) + 16;
      return t;
    }
    case 'status-grid': return 24 + (n.rows || []).length * 52 + (n.legend ? 28 : 0);
    case 'table': return (n.toolbar ? 60 : 0) + 42 + (n.rows || []).length * 56 + (n.footer ? 40 : 0);
    case 'stat': return 78;
    case 'input': case 'select': return 66;
    case 'textarea': return 120;
    case 'checkbox': case 'radio': case 'toggle': return n.emphasis ? 44 : 26;
    case 'button': return 36;
    case 'alert': return 66;
    case 'empty': return 190;
    case 'tabs': return 44;
    case 'accordion': return (n.items || []).length * 52;
    case 'skeleton': return 80;
    default: return 26;
  }
}
function lintScreen(sc) {
  if (sc.id === '_kit') return;
  const states = sc.states || {};
  const firstKey = sc.default || Object.keys(states)[0];
  const bodies = new Map();
  if (sc.body) bodies.set('screen', sc.body);
  for (const [k, s] of Object.entries(states)) if (s.body) bodies.set(k, s.body);
  const bare = sc.shell === 'none';
  for (const [k, body] of bodies) {
    const where = `${sc.id}.${k}`;
    let primaries = 0;
    walk(body, (n, ctx) => {
      if (n.type === 'button' && n.variant === 'primary') primaries++;
      if (n.type === 'button' && n.full && ctx.card && !bare) err(`${where}: lint: full-width button inside card "${ctx.card.title || ''}"; put the action in the card's "actions" or drop "full"`);
      if (FIELD.has(n.type) && ctx.card && norm(n.label) && norm(n.label) === norm(ctx.card.title)) err(`${where}: lint: field label "${n.label}" repeats its card title; use a shorter label`);
      if (n.type === 'status-grid' && ctx.gridCols > 1) err(`${where}: lint: status-grid inside a multi-column grid is too narrow; use one full-width card per series`);
      if (n.type === 'card') {
        if (n.description && (norm(n.description) === norm(n.title) || wordCount(n.description) > 6)) warn(`${where}: lint: card "${n.title}" description should be at most 6 words and not repeat the title`);
        if (!bare) {
          const fields = [];
          const types = new Set();
          walk(n.children || [], (m) => { types.add(m.type); if (FIELD.has(m.type)) fields.push(m); });
          const plain = !["status-grid", "table", "accordion", "grid", "card", "tabs", "empty", "person", "stat"].some((t) => types.has(t));
          if (plain && fields.length === 1 && !fields[0].width) err(`${where}: lint: card "${n.title || ''}" has a single field; set "width" on it (for example "320px")`);
        }
      }
      if (n.type === 'heading' && n.sub && wordCount(n.sub) > 10) warn(`${where}: lint: heading subtitle is ${wordCount(n.sub)} words; keep it to one short line (rules go in notes)`);
    });
    if (primaries > 1) warn(`${where}: lint: ${primaries} primary buttons; keep one primary per screen, the rest secondary`);
    if ((k === 'screen' || k === firstKey) && est(body) > 1500) warn(`${where}: lint: page is about ${est(body)}px tall; compact it or move detail into tabs or an accordion`);
  }
}

/* ---------- main ---------- */
const readJson = (f) => {
  try {
    return JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch (e) {
    err(`${f}: ${e.message}`);
    return null;
  }
};

const appFile = typeof APP_PATH === 'string' ? APP_PATH : path.join(specsDir, 'app.json');
const app = fs.existsSync(appFile) ? readJson(appFile) || {} : { name: 'App' };
const screensDir = path.join(specsDir, 'screens');
const files = fs.existsSync(screensDir) ? fs.readdirSync(screensDir).filter((f) => f.endsWith('.json')).sort() : [];
if (!files.length) err(`no screen specs found in ${screensDir}`);
const screens = files.map((f) => ({ f, sc: readJson(path.join(screensDir, f)) })).filter((x) => x.sc);
SCREEN_IDS = new Set(screens.map((x) => x.sc.id));
for (const { f, sc } of screens) {
  if (!/^SCR-[a-z0-9]+(-[a-z0-9]+)*$/.test(sc.id || '')) err(`${f}: id "${sc.id}" must look like SCR-kebab-name`);
  if (!sc.title) err(`${f}: missing "title"`);
}
const dupes = screens.map((x) => x.sc.id).filter((id, i, a) => a.indexOf(id) !== i);
dupes.forEach((d) => err(`duplicate screen id ${d}`));

for (const { sc } of screens) lintScreen(sc);
fs.mkdirSync(outDir, { recursive: true });
const written = new Set();
const write = (name, html) => {
  fs.writeFileSync(path.join(outDir, name), html);
  written.add(name);
};
for (const { sc } of screens) write(`${sc.id}.html`, renderScreen(sc, app));

// component gallery, rendered with link validation off
const gallery = readJson(path.join(here, '../../assets/wireframe/gallery.json'));
if (gallery && !NO_KIT) {
  const saved = SCREEN_IDS;
  SCREEN_IDS = null;
  write('_kit.html', renderScreen(gallery, { name: 'Wireframe kit' }));
  SCREEN_IDS = saved;
}

// remove stale generated pages so the file set always equals the specs
// remove stale generated pages so the file set always equals the specs. index.html is only removed when it is
// an old generated screen list (class="ix"), never the compare page that compare.mjs --flat writes there.
for (const f of fs.readdirSync(outDir)) {
  if (written.has(f)) continue;
  if (/^(SCR-[a-z0-9-]+|_kit)\.html$/.test(f)) fs.unlinkSync(path.join(outDir, f));
  else if (f === 'index.html' && fs.readFileSync(path.join(outDir, f), 'utf8').includes('class="ix"')) fs.unlinkSync(path.join(outDir, f));
}

const stateCount = screens.reduce((a, x) => a + Math.max(1, Object.keys(x.sc.states || {}).length), 0);
warnings.forEach((w) => console.log(`warn  ${w}`));
errors.forEach((e) => console.log(`ERROR ${e}`));
console.log(`render: ${screens.length} screens, ${stateCount} states -> ${outDir}/ | ${errors.length} errors, ${warnings.length} warnings`);
process.exit(errors.length ? 1 : 0);
