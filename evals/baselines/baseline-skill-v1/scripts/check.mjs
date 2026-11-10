#!/usr/bin/env node
// spec-it check: trace, contrast, lint, interview, and API consistency for specs/<slug>.
// Usage: node check.mjs <spec dir> [--json]
// Exit 0 when there are no errors, 1 when there are errors, 2 on bad usage.
// Zero dependencies; Node 18+.

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const args = process.argv.slice(2);
const asJson = args.includes("--json");
const specDir = args.find((a) => !a.startsWith("--"));

if (!specDir) {
  console.error("Usage: node check.mjs <spec dir> [--json]");
  process.exit(2);
}
if (!fs.existsSync(specDir) || !fs.statSync(specDir).isDirectory()) {
  console.error(`Not a directory: ${specDir}`);
  process.exit(2);
}

const GROUPS = ["files", "interview", "trace", "contrast", "lint", "api"];
const findings = Object.fromEntries(GROUPS.map((g) => [g, { errors: [], warnings: [] }]));
const err = (group, msg) => findings[group].errors.push(msg);
const warn = (group, msg) => findings[group].warnings.push(msg);

const rel = (p) => path.relative(specDir, p).split(path.sep).join("/");
const read = (p) => (fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null);
const uniq = (xs) => [...new Set(xs)];
const idNum = (id) => Number(id.split("-")[1]);
const sortIds = (ids) => uniq(ids).sort((a, b) => idNum(a) - idNum(b));
const rangeText = (ids) => (ids.length ? `${ids[0]}..${ids[ids.length - 1]}` : "none");

// ---------- Spec ----------

const specPath = path.join(specDir, "REQUIREMENTS.md");
const spec = read(specPath);
if (spec === null) err("files", "REQUIREMENTS.md is missing.");

const specBody = spec ?? "";
const logStart = specBody.search(/^##\s+\d*\.?\s*Decision log/im);
const specOutsideLog = logStart === -1 ? specBody : specBody.slice(0, logStart);

function blocks(text, idPattern) {
  const re = new RegExp(`^###\\s+(${idPattern})\\b(.*)$`, "gm");
  const heads = [...text.matchAll(re)];
  return heads.map((m, i) => {
    const start = m.index + m[0].length;
    const nextHead = text.slice(start).search(/^#{2,3}\s/m);
    const end = nextHead === -1 ? text.length : start + nextHead;
    return { id: m[1], head: m[2], body: text.slice(start, end) };
  });
}

const lineValue = (body, label) => {
  const m = body.match(new RegExp(`^\\s*${label}:\\s*(.+)$`, "im"));
  return m ? m[1].trim() : null;
};

const frBlocks = blocks(specOutsideLog, "FR-\\d+");
const ecBlocks = blocks(specOutsideLog, "EC-\\d+");

const frs = new Map();
for (const b of frBlocks) {
  if (frs.has(b.id)) err("trace", `${b.id} is defined twice.`);
  const removed = /\(removed\)/i.test(b.head);
  const pr = b.head.match(/\b(Must|Should|Could)\b/);
  const shown = lineValue(b.body, "Shown in");
  frs.set(b.id, {
    id: b.id,
    removed,
    priority: pr ? pr[1] : null,
    source: (lineValue(b.body, "Source") || "").match(/D-\d+/g) || [],
    shown,
    noUi: shown ? /^none\b/i.test(shown) : false,
    body: b.body,
  });
}

const ecs = new Map();
for (const b of ecBlocks) {
  if (ecs.has(b.id)) err("trace", `${b.id} is defined twice.`);
  ecs.set(b.id, {
    id: b.id,
    removed: /\(removed\)/i.test(b.head),
    linked: (lineValue(b.body, "Linked") || "").match(/FR-\d+/g) || [],
    state: lineValue(b.body, "State"),
  });
}

const frIds = sortIds([...frs.keys()]);
const ecIds = sortIds([...ecs.keys()]);

if (spec !== null) {
  if (!frIds.length) err("trace", "REQUIREMENTS.md defines no FRs (expected headings like `### FR-1 · Must · Title`).");
  for (const fr of frs.values()) {
    if (fr.removed) continue;
    if (!fr.priority) err("trace", `${fr.id} has no priority (Must, Should, or Could) in its heading.`);
    const hasGwt = /^\s*[-*]?\s*Given\b/im.test(fr.body) && /^\s*[-*]?\s*When\b/im.test(fr.body) && /^\s*[-*]?\s*Then\b/im.test(fr.body);
    if (!hasGwt) err("trace", `${fr.id} has no Given/When/Then acceptance criteria.`);
    if (!fr.source.length) err("trace", `${fr.id} has no "Source:" decisions.`);
    if (fr.priority === "Must" && !fr.shown) err("trace", `${fr.id} is Must but has no "Shown in:" line (use "Shown in: none (no UI)" if it has no surface).`);
  }
  for (const ec of ecs.values()) {
    if (ec.removed) continue;
    if (!ec.linked.length) err("trace", `${ec.id} has no "Linked:" FR.`);
    for (const f of ec.linked) if (!frs.has(f)) err("trace", `${ec.id} links ${f}, which is not defined. Known: ${rangeText(frIds)}`);
    if (!ec.state) err("trace", `${ec.id} has no "State:" artifact state.`);
  }
}

// ---------- Interview ----------

const intake = read(path.join(specDir, "00-intake.md"));
const decisions = read(path.join(specDir, "01-decisions.md"));
if (intake === null) warn("files", "00-intake.md is missing.");
if (decisions === null) warn("files", "01-decisions.md is missing.");

const decisionNodes = new Map();
if (decisions !== null) {
  for (const m of decisions.matchAll(/^\s*-\s+(D-\d+)\s+\[(open|settled|assumed|fact)\](.*)$/gm)) {
    decisionNodes.set(m[1], { id: m[1], status: m[2], rest: m[3] });
  }
  if (!decisionNodes.size) err("interview", "01-decisions.md has no decision lines (expected `- D-1 [settled] Title · own · Q1`).");

  const budgetText = (intake && lineValue(intake, "Budget")) || lineValue(decisions, "Budget") || "";
  const nums = (budgetText.match(/\d+/g) || []).map(Number);
  const asked = uniq([...decisions.matchAll(/^\s*-\s+D-\d+\s+\[[a-z]+\].*?\b(Q\d+)\b/gm)].map((m) => m[1]));
  const provenance = { own: 0, accepted: 0, assumed: 0 };

  for (const n of decisionNodes.values()) {
    if (n.status === "open") continue;
    const p = n.rest.match(/·\s*(own|accepted|assumed|fact)\b/);
    if (!p) err("interview", `${n.id} [${n.status}] has no provenance (own, accepted, assumed, or fact).`);
    else if (p[1] in provenance && /\bQ\d+\b/.test(n.rest)) provenance[p[1]]++;
    if (n.status === "assumed" && !/A-\d+/.test(n.rest)) warn("interview", `${n.id} is assumed but names no A-n assumption.`);
  }

  const open = [...decisionNodes.values()].filter((n) => n.status === "open").map((n) => n.id);
  if (open.length) warn("interview", `Decisions still open: ${sortIds(open).join(", ")}.`);

  if (/per module/i.test(budgetText)) {
    warn("interview", `Per-module budget (${budgetText}); question count not checked.`);
  } else if (nums.length) {
    const [lo, hi] = nums.length === 1 ? [0, nums[0]] : [nums[0], nums[1]];
    if (asked.length > hi) err("interview", `${asked.length} questions asked; budget is ${budgetText}.`);
    else if (asked.length < lo) warn("interview", `${asked.length} questions asked, below the budget floor of ${lo} (fine if the developer said "enough").`);
  } else {
    warn("interview", "No `Budget:` line found in 00-intake.md or 01-decisions.md.");
  }

  const totalAsked = provenance.own + provenance.accepted + provenance.assumed;
  if (totalAsked && provenance.accepted / totalAsked > 0.7) {
    warn("interview", `${provenance.accepted} of ${totalAsked} answers were accepted recommendations; confirm the 70% check ran.`);
  }
  if (!/^Confirmed:\s*yes\b/im.test(decisions)) err("interview", "The restate is not confirmed (expected a `Confirmed: yes` line under ## Restate).");

  if (spec !== null) {
    for (const n of decisionNodes.values()) {
      if (n.status === "open") continue;
      const cited = new RegExp(`\\b${n.id}\\b`).test(specOutsideLog);
      if (!cited) {
        if (n.status === "fact") warn("interview", `${n.id} (fact) is not cited in REQUIREMENTS.md.`);
        else err("interview", `${n.id} maps to nothing: cite it in an FR Source, an EC, an assumption, or a non-goal.`);
      }
    }
    for (const fr of frs.values()) {
      for (const d of fr.source) if (!decisionNodes.has(d)) err("trace", `${fr.id} cites ${d}, which is not in 01-decisions.md.`);
    }
  }
}

// ---------- Artifacts ----------

const ARTIFACT_DIRS = ["screens", "api", "cli"].map((d) => path.join(specDir, d)).filter((d) => fs.existsSync(d));
const htmlFiles = [];
for (const d of ARTIFACT_DIRS) {
  for (const f of fs.readdirSync(d)) if (f.toLowerCase().endsWith(".html")) htmlFiles.push(path.join(d, f));
}

if (spec !== null && !htmlFiles.length) err("files", "No artifacts found in screens/, api/, or cli/.");

const stripComments = (s) => s.replace(/<!--[\s\S]*?-->/g, "");
const stripBlocks = (s, tags) => tags.reduce((acc, t) => acc.replace(new RegExp(`<${t}\\b[\\s\\S]*?<\\/${t}>`, "gi"), ""), s);

function attrs(attrText) {
  const out = {};
  for (const m of attrText.matchAll(/([\w:.-]+)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g)) {
    out[m[1].toLowerCase()] = m[3] ?? m[4] ?? m[5] ?? "";
  }
  return out;
}

function tags(html) {
  const out = [];
  for (const m of html.matchAll(/<([a-zA-Z][\w-]*)\b([^>]*)>/g)) out.push({ name: m[1].toLowerCase(), attrs: attrs(m[2]), index: m.index });
  return out;
}

const artifacts = htmlFiles.map((file) => {
  const raw = read(file);
  const html = stripComments(raw);
  const markup = stripBlocks(html, ["script", "style"]);
  const t = tags(markup);
  const tokens = (name) => uniq(t.flatMap((x) => (x.attrs[name] ? x.attrs[name].split(/\s+/).filter(Boolean) : [])));
  return {
    file,
    name: path.basename(file).toLowerCase(),
    dir: path.dirname(file),
    raw,
    html,
    markup,
    tags: t,
    fr: tokens("data-fr"),
    ec: tokens("data-ec"),
    states: tokens("data-state"),
    endpoints: t.filter((x) => x.attrs["data-endpoint"]).map((x) => x.attrs["data-endpoint"].trim().replace(/\s+/g, " ")),
    commands: t.filter((x) => x.attrs["data-command"]).map((x) => x.attrs["data-command"]),
  };
});

const byPath = new Map(artifacts.map((a) => [path.resolve(a.file), a]));
// In screens/, index.html and design-system.html are navigation and reference pages.
// In api/ and cli/, index.html is the artifact itself.
const screensDir = path.join(specDir, "screens");
const isUtility = (a) => a.dir === screensDir && (a.name === "index.html" || a.name === "design-system.html");

// Trace: artifact IDs exist, coverage of Must FRs and ECs, "Shown in" and "State" targets.
const frsInArtifacts = new Set(artifacts.flatMap((a) => a.fr));
const ecsInArtifacts = new Set(artifacts.flatMap((a) => a.ec));

for (const a of artifacts) {
  for (const id of a.fr) if (!/^FR-\d+$/.test(id)) err("trace", `${rel(a.file)}: data-fr value "${id}" is not an FR ID.`);
  for (const id of a.ec) if (!/^EC-\d+$/.test(id)) err("trace", `${rel(a.file)}: data-ec value "${id}" is not an EC ID.`);
  if (spec !== null) {
    for (const id of a.fr) if (/^FR-\d+$/.test(id) && !frs.has(id)) err("trace", `${id} in ${rel(a.file)} not found in REQUIREMENTS.md. Known: ${rangeText(frIds)}`);
    for (const id of a.ec) if (/^EC-\d+$/.test(id) && !ecs.has(id)) err("trace", `${id} in ${rel(a.file)} not found in REQUIREMENTS.md. Known: ${rangeText(ecIds)}`);
  }
  if (!isUtility(a) && !a.fr.length) err("trace", `${rel(a.file)} has no data-fr attributes.`);
}

function resolveTarget(ref) {
  const [p, query] = ref.split("?");
  const file = path.resolve(specDir, p.trim());
  const state = query ? new URLSearchParams(query).get("state") : null;
  return { file, state, label: p.trim() };
}

if (spec !== null && htmlFiles.length) {
  for (const fr of frs.values()) {
    if (fr.removed || fr.noUi) continue;
    if (fr.priority === "Must" && !frsInArtifacts.has(fr.id)) err("trace", `${fr.id} is Must but no artifact has data-fr="${fr.id}".`);
    if (fr.shown) {
      for (const ref of fr.shown.split(",").map((s) => s.trim()).filter(Boolean)) {
        const { file, label } = resolveTarget(ref);
        const a = byPath.get(file);
        if (!a) err("trace", `${fr.id} "Shown in" ${label}, which does not exist.`);
        else if (!a.fr.includes(fr.id)) err("trace", `${fr.id} "Shown in" ${label}, but that file has no data-fr="${fr.id}".`);
      }
    }
  }
  for (const ec of ecs.values()) {
    if (ec.removed) continue;
    if (!ecsInArtifacts.has(ec.id)) err("trace", `${ec.id} has no artifact state (no element has data-ec="${ec.id}").`);
    if (ec.state) {
      const { file, state, label } = resolveTarget(ec.state);
      const a = byPath.get(file);
      if (!a) err("trace", `${ec.id} "State" ${label}, which does not exist.`);
      else if (state && !a.states.includes(state)) err("trace", `${ec.id} "State" ${label}?state=${state}, but that file declares no data-state="${state}". Declared: ${a.states.join(", ") || "none"}`);
    }
  }
}

// Index coverage and internal links.
const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:)?\/\//i;
const SKIP_LINK = /^(?:#|mailto:|tel:|data:|javascript:)/i;

for (const d of ARTIFACT_DIRS) {
  const inDir = artifacts.filter((a) => a.dir === d);
  if (!inDir.length) continue;
  const index = inDir.find((a) => a.name === "index.html");
  if (!index) {
    err("trace", `${rel(d)}/ has no index.html.`);
    continue;
  }
  const linked = new Set(
    index.tags
      .filter((t) => t.name === "a" && t.attrs.href && !EXTERNAL.test(t.attrs.href) && !SKIP_LINK.test(t.attrs.href))
      .map((t) => path.resolve(d, t.attrs.href.split(/[?#]/)[0]))
  );
  for (const a of inDir) if (a !== index && !linked.has(path.resolve(a.file))) err("trace", `${rel(a.file)} is not linked from ${rel(index.file)}.`);
}

for (const a of artifacts) {
  for (const t of a.tags) {
    for (const attr of ["href", "src"]) {
      const v = t.attrs[attr];
      if (!v || SKIP_LINK.test(v)) continue;
      if (EXTERNAL.test(v)) {
        err("lint", `${rel(a.file)}: external URL in ${attr}="${v}". Artifacts must work offline.`);
        continue;
      }
      const target = path.resolve(a.dir, decodeURI(v.split(/[?#]/)[0]));
      if (!fs.existsSync(target)) err("trace", `${rel(a.file)}: broken link ${attr}="${v}".`);
    }
  }
}

// ---------- Lint ----------

const themePath = path.join(specDir, "assets", "theme.css");
const theme = read(themePath);
const themeHasFocus = theme ? /:focus-visible/.test(theme) : false;

function lintCss(css, where) {
  if (/transition(?:-property)?\s*:\s*all\b/i.test(css)) err("lint", `${where}: "transition: all"; list the properties instead.`);
  if (/(?:@import|url\()\s*["']?\s*(?:https?:)?\/\//i.test(css)) err("lint", `${where}: external URL in CSS. Artifacts must work offline.`);
}

for (const a of artifacts) {
  const where = rel(a.file);
  const styles = [...a.html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join("\n");
  const inline = a.tags.map((t) => t.attrs.style || "").join(";");
  const css = `${styles}\n${inline}`;
  lintCss(css, where);
  if (/outline\s*:\s*(?:none|0)\b/i.test(css) && !/:focus-visible/.test(styles) && !themeHasFocus) {
    err("lint", `${where}: "outline: none" without a :focus-visible replacement.`);
  }

  const text = stripBlocks(a.markup, ["pre", "code"]).replace(/<[^>]+>/g, " ");
  if (/lorem\s+ipsum/i.test(text)) err("lint", `${where}: lorem ipsum. Use fixture data.`);
  if (/\.\.\./.test(text)) err("lint", `${where}: "..." in copy; use "…".`);

  for (const t of a.tags) {
    if (t.name === "img") {
      if (!("alt" in t.attrs)) err("lint", `${where}: <img src="${t.attrs.src || ""}"> has no alt.`);
      if (!t.attrs.width || !t.attrs.height) err("lint", `${where}: <img src="${t.attrs.src || ""}"> needs width and height.`);
    }
    if ((t.name === "div" || t.name === "span") && "onclick" in t.attrs) err("lint", `${where}: <${t.name} onclick>; use <button> or <a>.`);
  }

  const labelFor = new Set(a.tags.filter((t) => t.name === "label" && t.attrs.for).map((t) => t.attrs.for));
  for (const t of a.tags) {
    if (!["input", "select", "textarea"].includes(t.name)) continue;
    const type = (t.attrs.type || "").toLowerCase();
    if (["hidden", "submit", "button", "reset", "image"].includes(type)) continue;
    const named = t.attrs["aria-label"] || t.attrs["aria-labelledby"] || t.attrs.title || (t.attrs.id && labelFor.has(t.attrs.id));
    const before = a.markup.slice(0, t.index);
    const wrapped = (before.match(/<label\b/gi) || []).length > (before.match(/<\/label>/gi) || []).length;
    if (!named && !wrapped) err("lint", `${where}: <${t.name}${t.attrs.name ? ` name="${t.attrs.name}"` : ""}> has no label.`);
  }

  for (const m of a.markup.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi)) {
    const at = attrs(m[1]);
    const inner = m[2].replace(/<svg[\s\S]*?<\/svg>/gi, "").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();
    if (!inner && !at["aria-label"] && !at["aria-labelledby"] && !at.title) err("lint", `${where}: icon-only <button> has no aria-label.`);
  }

  if (!/<title>\s*[^<\s][\s\S]*?<\/title>/i.test(a.html)) err("lint", `${where}: missing <title>.`);
  if (!/<html\b[^>]*\blang=/i.test(a.html)) warn("lint", `${where}: <html> has no lang attribute.`);
  const h1s = a.tags.filter((t) => t.name === "h1").length;
  if (h1s !== 1) warn("lint", `${where}: ${h1s} <h1> elements; use exactly one.`);
}

for (const asset of ["app.js", "fixtures.js", "theme.css"]) {
  const p = path.join(specDir, "assets", asset);
  const s = read(p);
  if (s === null) continue;
  if (asset.endsWith(".css")) lintCss(s, `assets/${asset}`);
  else if (/(?:fetch|import|src\s*=)\s*\(?\s*["'](?:https?:)?\/\//i.test(s)) err("lint", `assets/${asset}: loads an external URL. Artifacts must work offline.`);
}
if (htmlFiles.length && !fs.existsSync(path.join(specDir, "assets", "fixtures.js"))) err("files", "assets/fixtures.js is missing; every artifact reads its data from it.");

// Forms: mockups have no server, so a form navigates with data-next.
for (const a of artifacts) {
  for (const t of a.tags) {
    if (t.name !== "form") continue;
    const method = (t.attrs.method || "").toLowerCase();
    if (method === "post") err("lint", `${rel(a.file)}: <form method="post">; mockups have no server. Use data-next="<next artifact>.html".`);
    else if (t.attrs.action && !t.attrs["data-next"]) err("lint", `${rel(a.file)}: <form action="${t.attrs.action}">; use data-next instead, which never puts form values in the URL.`);
    else if (!t.attrs["data-next"]) warn("lint", `${rel(a.file)}: <form> has no data-next; submitting it reloads the page.`);
  }
}

// Fixtures: every data-bind path resolves in the evaluated fixtures.js.
const fixturesSrc = read(path.join(specDir, "assets", "fixtures.js"));
let fixtures = null;
if (fixturesSrc !== null) {
  try {
    const sandbox = { window: {} };
    vm.runInNewContext(fixturesSrc, sandbox, { timeout: 1000 });
    fixtures = sandbox.window.FIXTURES ?? sandbox.FIXTURES ?? null;
    if (!fixtures) err("files", "assets/fixtures.js does not set window.FIXTURES.");
  } catch (e) {
    err("files", `assets/fixtures.js does not run: ${e.message}`);
  }
}
if (fixtures) {
  const getPath = (obj, p) => p.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
  for (const a of artifacts) {
    for (const t of a.tags) {
      const p = t.attrs["data-bind"];
      if (p && getPath(fixtures, p) === undefined) err("trace", `${rel(a.file)}: data-bind="${p}" has no value in fixtures.js.`);
    }
  }
}

// ---------- Contrast ----------

function parseVars(css) {
  const vars = {};
  for (const m of css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/(--[\w-]+)\s*:\s*([^;}]+)/g)) vars[m[1]] = m[2].trim();
  return vars;
}

function resolveVar(value, vars, depth = 0) {
  if (depth > 20) return null;
  return value.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^)]+))?\)/g, (_, name, fallback) => {
    const v = vars[name] ?? fallback;
    return v == null ? "" : resolveVar(v, vars, depth + 1) ?? "";
  });
}

const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const clamp01 = (x) => Math.min(1, Math.max(0, x));

function num(token, scale = 1) {
  token = token.trim();
  if (token.endsWith("%")) return (parseFloat(token) / 100) * scale;
  return parseFloat(token);
}

// Returns { r, g, b } in linear sRGB (0..1) plus alpha, or null.
function parseColor(input) {
  const s = input.trim().toLowerCase();
  const named = { white: "#ffffff", black: "#000000" };
  if (named[s]) return parseColor(named[s]);
  let m = s.match(/^#([0-9a-f]{3,8})$/);
  if (m) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join("");
    if (h.length !== 6 && h.length !== 8) return null;
    const [r, g, b] = [0, 2, 4].map((i) => srgbToLinear(parseInt(h.slice(i, i + 2), 16) / 255));
    const alpha = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
    return { r, g, b, alpha };
  }
  m = s.match(/^rgba?\(([^)]+)\)$/);
  if (m) {
    const [rgb, a] = m[1].split("/");
    const parts = rgb.split(/[\s,]+/).filter(Boolean);
    const alphaPart = a ?? parts[3];
    const [r, g, b] = parts.slice(0, 3).map((p) => srgbToLinear(clamp01(num(p, 255) / 255)));
    return { r, g, b, alpha: alphaPart == null ? 1 : clamp01(num(alphaPart, 1)) };
  }
  m = s.match(/^oklch\(([^)]+)\)$/);
  if (m) {
    const [lch, a] = m[1].split("/");
    const [lt, ct, ht] = lch.trim().split(/\s+/);
    const L = num(lt, 1);
    const C = ct.endsWith("%") ? (parseFloat(ct) / 100) * 0.4 : parseFloat(ct);
    const H = (parseFloat(ht) * Math.PI) / 180;
    const A = C * Math.cos(H);
    const B = C * Math.sin(H);
    const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
    const mm = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
    const sv = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
    return {
      r: clamp01(4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * sv),
      g: clamp01(-1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * sv),
      b: clamp01(-0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * sv),
      alpha: a == null ? 1 : clamp01(num(a, 1)),
    };
  }
  return null;
}

const luminance = (c) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
const over = (fg, bg) => ({
  r: fg.r * fg.alpha + bg.r * (1 - fg.alpha),
  g: fg.g * fg.alpha + bg.g * (1 - fg.alpha),
  b: fg.b * fg.alpha + bg.b * (1 - fg.alpha),
  alpha: 1,
});

let pairsChecked = 0;
if (htmlFiles.length && theme === null) err("contrast", "assets/theme.css is missing.");
if (theme !== null) {
  const vars = parseVars(theme);
  const pairs = [...theme.matchAll(/@pair\s+(--[\w-]+)\s+on\s+(--[\w-]+)(?:\s+(\d+(?:\.\d+)?))?/g)];
  if (!pairs.length) err("contrast", "assets/theme.css declares no `@pair --fg on --bg 4.5` lines.");
  for (const [, fgName, bgName, minText] of pairs) {
    const min = minText ? Number(minText) : 4.5;
    const fgRaw = vars[fgName];
    const bgRaw = vars[bgName];
    if (fgRaw == null || bgRaw == null) {
      err("contrast", `@pair ${fgName} on ${bgName}: ${fgRaw == null ? fgName : bgName} is not defined.`);
      continue;
    }
    const fg = parseColor(resolveVar(fgRaw, vars) ?? "");
    const bg = parseColor(resolveVar(bgRaw, vars) ?? "");
    if (!fg || !bg) {
      warn("contrast", `@pair ${fgName} on ${bgName}: cannot parse "${!fg ? fgRaw : bgRaw}" (supported: hex, rgb(), oklch()).`);
      continue;
    }
    if (bg.alpha < 1) warn("contrast", `${bgName} is translucent; its contrast depends on what sits behind it.`);
    const ratio = (() => {
      const f = fg.alpha < 1 ? over(fg, bg) : fg;
      const [hi, lo] = [luminance(f), luminance(bg)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    })();
    pairsChecked++;
    if (ratio + 1e-9 < min) err("contrast", `${fgName} on ${bgName} is ${ratio.toFixed(2)}:1; needs ${min}:1.`);
  }
}

// ---------- API ----------

const apiIndex = artifacts.find((a) => a.dir === path.join(specDir, "api") && a.name === "index.html");
if (apiIndex) {
  const yamlPath = path.join(specDir, "api", "openapi.yaml");
  const yaml = read(yamlPath);
  if (yaml === null) err("api", "api/openapi.yaml is missing.");
  else {
    const ops = [];
    let inPaths = false;
    let current = null;
    for (const line of yaml.split(/\r?\n/)) {
      if (/^\S/.test(line)) {
        inPaths = /^paths\s*:/.test(line);
        current = null;
        continue;
      }
      if (!inPaths) continue;
      const p = line.match(/^ {2}["']?(\/[^"':]*)["']?\s*:\s*$/);
      if (p) {
        current = p[1];
        continue;
      }
      const op = line.match(/^ {4}(get|put|post|delete|patch|head|options|trace)\s*:/i);
      if (op && current) ops.push(`${op[1].toUpperCase()} ${current}`);
    }
    const page = uniq(apiIndex.endpoints.map((e) => e.replace(/^(\w+)/, (x) => x.toUpperCase())));
    if (!page.length) err("api", "api/index.html has no data-endpoint sections.");
    for (const e of page) if (!ops.includes(e)) err("api", `${e} is on api/index.html but not in openapi.yaml.`);
    for (const o of ops) if (!page.includes(o)) err("api", `${o} is in openapi.yaml but not on api/index.html.`);
  }
}

const cliIndex = artifacts.find((a) => a.dir === path.join(specDir, "cli") && a.name === "index.html");
if (cliIndex) {
  if (!cliIndex.commands.length) err("api", "cli/index.html has no data-command sections.");
  for (const m of cliIndex.markup.matchAll(/<figure\b([^>]*)>([\s\S]*?)<\/figure>/gi)) {
    const at = attrs(m[1]);
    if (at["data-ec"] && !/exit\s+\d+/i.test(m[2])) warn("api", `cli/index.html: transcript for ${at["data-ec"]} shows no exit code.`);
  }
}

// ---------- Report ----------

const totals = {
  errors: GROUPS.reduce((n, g) => n + findings[g].errors.length, 0),
  warnings: GROUPS.reduce((n, g) => n + findings[g].warnings.length, 0),
};
const counts = {
  frs: [...frs.values()].filter((f) => !f.removed).length,
  ecs: [...ecs.values()].filter((e) => !e.removed).length,
  decisions: decisionNodes.size,
  artifacts: artifacts.filter((a) => !isUtility(a)).length,
  contrastPairs: pairsChecked,
};

if (asJson) {
  console.log(JSON.stringify({ specDir, counts, totals, findings }, null, 2));
} else {
  for (const g of GROUPS) {
    const { errors, warnings } = findings[g];
    if (!errors.length && !warnings.length) continue;
    console.log(`\n## ${g}`);
    for (const e of errors) console.log(`  ✗ ${e}`);
    for (const w of warnings) console.log(`  ! ${w}`);
  }
  const status = GROUPS.map((g) => `${findings[g].errors.length ? "✗" : "✓"} ${g}`).join("  ");
  console.log(
    `\n${status}  |  ${counts.frs} FRs, ${counts.ecs} ECs, ${counts.decisions} decisions, ${counts.artifacts} artifacts, ${counts.contrastPairs} contrast pairs  |  ${totals.errors} errors, ${totals.warnings} warnings`
  );
}

process.exit(totals.errors ? 1 : 0);
