#!/usr/bin/env node
// Runs the skill's check script on every eval fixture. Exits non-zero if any fixture fails.
// Usage: node scripts/check-fixtures.mjs
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const check = path.join(root, "plugins", "clearspec", "skills", "clearspec", "scripts", "check.mjs");
const fixtures = path.join(root, "evals", "fixtures");

// A fixture unit is any folder that holds a REQUIREMENTS.md.
const units = [];
const walk = (dir) => {
  for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    const full = path.join(dir, d.name);
    if (fs.existsSync(path.join(full, "REQUIREMENTS.md"))) units.push(full);
    else walk(full);
  }
};
walk(fixtures);

let failed = 0;
for (const unit of units) {
  const r = spawnSync(process.execPath, [check, unit], { encoding: "utf8" });
  const summary = r.stdout.trim().split("\n").pop();
  console.log(`${r.status === 0 ? "pass" : "FAIL"}  ${path.relative(root, unit)}\n      ${summary}`);
  if (r.status !== 0) {
    failed++;
    console.log(r.stdout);
  }
}
console.log(`\n${units.length - failed}/${units.length} fixtures pass.`);
process.exit(failed ? 1 : 0);
