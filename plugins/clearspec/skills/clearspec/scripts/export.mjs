#!/usr/bin/env node
// Writes self-contained copies of every artifact to mockups/export/: local stylesheets, scripts,
// images, and fonts are inlined, so each HTML file opens on its own and can be sent to anyone.
// Links between artifacts keep working because every export sits next to its siblings.
// Usage: node export.mjs <unit dir>
// Zero dependencies; Node 18+.

import fs from "node:fs";
import path from "node:path";

const unitDir = process.argv[2];
if (!unitDir) {
  console.error("Usage: node export.mjs <unit dir, e.g. clearspec/1-habit-tracker>");
  process.exit(2);
}
const mockups = path.join(unitDir, "mockups");
if (!fs.existsSync(mockups)) {
  console.error(`Not found: ${mockups}`);
  process.exit(1);
}
const outDir = path.join(mockups, "export");
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const MIME = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
};
const isLocal = (ref) => ref && !/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(ref);
const dataUri = (file) => `data:${MIME[path.extname(file).toLowerCase()] || "application/octet-stream"};base64,${fs.readFileSync(file).toString("base64")}`;
const missing = [];

function inlineCssUrls(css, cssDir) {
  return css.replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/g, (whole, q, ref) => {
    if (!isLocal(ref)) return whole;
    const file = path.resolve(cssDir, ref.split(/[?#]/)[0]);
    if (!fs.existsSync(file)) return missing.push(ref), whole;
    return `url("${dataUri(file)}")`;
  });
}

let count = 0;
for (const name of fs.readdirSync(mockups).filter((f) => f.toLowerCase().endsWith(".html"))) {
  let html = fs.readFileSync(path.join(mockups, name), "utf8");

  html = html.replace(/<link\b[^>]*rel=["']stylesheet["'][^>]*>/gi, (tag) => {
    const href = (tag.match(/href=["']([^"']+)["']/) || [])[1];
    if (!isLocal(href)) return tag;
    const file = path.resolve(mockups, href);
    if (!fs.existsSync(file)) return missing.push(href), tag;
    return `<style>\n${inlineCssUrls(fs.readFileSync(file, "utf8"), path.dirname(file))}\n</style>`;
  });

  html = html.replace(/<style\b([^>]*)>([\s\S]*?)<\/style>/gi, (whole, a, css) => `<style${a}>${inlineCssUrls(css, mockups)}</style>`);

  html = html.replace(/<script\b([^>]*)\bsrc=["']([^"']+)["']([^>]*)>\s*<\/script>/gi, (tag, before, src, after) => {
    if (!isLocal(src)) return tag;
    const file = path.resolve(mockups, src);
    if (!fs.existsSync(file)) return missing.push(src), tag;
    const js = fs.readFileSync(file, "utf8").replace(/<\/script/gi, "<\\/script");
    return `<script${before}${after}>\n${js}\n</script>`;
  });

  html = html.replace(/<img\b([^>]*)\bsrc=["']([^"']+)["']/gi, (tag, before, src) => {
    if (!isLocal(src)) return tag;
    const file = path.resolve(mockups, src);
    if (!fs.existsSync(file)) return missing.push(src), tag;
    return `<img${before}src="${dataUri(file)}"`;
  });

  fs.writeFileSync(path.join(outDir, name), html);
  count++;
}

for (const extra of ["openapi.yaml", "transcripts.md"]) {
  const file = path.join(mockups, extra);
  if (fs.existsSync(file)) fs.copyFileSync(file, path.join(outDir, extra));
}

console.log(`Exported ${count} self-contained files to ${outDir}`);
if (missing.length) {
  console.error(`Not found, left as links: ${[...new Set(missing)].join(", ")}`);
  process.exit(1);
}
