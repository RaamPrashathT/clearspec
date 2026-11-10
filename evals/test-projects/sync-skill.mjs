#!/usr/bin/env node
// Copies the current clearspec skill into every test project's .claude/skills/clearspec.
// evals/ is left out on purpose: its personas hold the hidden requirements a test run must not see.
// Usage: node sync-skill.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const source = path.resolve(here, "..", "..", "plugins", "clearspec", "skills", "clearspec");
const parts = ["SKILL.md", "references", "assets", "scripts"];

if (!fs.existsSync(path.join(source, "SKILL.md"))) {
  console.error(`Skill not found at ${source}`);
  process.exit(1);
}

const projects = fs
  .readdirSync(here, { withFileTypes: true })
  .filter((d) => d.isDirectory() && /^\d{2}-/.test(d.name))
  .map((d) => d.name);

for (const name of projects) {
  const target = path.join(here, name, ".claude", "skills", "clearspec");
  fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(target, { recursive: true });
  for (const part of parts) fs.cpSync(path.join(source, part), path.join(target, part), { recursive: true });
  console.log(`synced ${name}`);
}
