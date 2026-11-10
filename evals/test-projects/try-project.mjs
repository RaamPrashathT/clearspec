#!/usr/bin/env node
// Copies a test project to a folder outside this repo, commits it as a fresh git repo, and installs the
// current skill into its .claude/skills/. Use it to try the skill by hand without touching the repo.
// Usage: node try-project.mjs <project, e.g. 04-node-cli> [dest dir] [--skill-dir <dir>]
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flagAt = args.indexOf("--skill-dir");
const skillDir = path.resolve(flagAt === -1 ? path.join(here, "..", "..", "plugins", "clearspec", "skills", "clearspec") : args[flagAt + 1]);
const positional = args.filter((a, i) => !a.startsWith("--") && (flagAt === -1 || i !== flagAt + 1));
const [project, destArg] = positional;

const src = project && path.join(here, project);
if (!src || !fs.existsSync(src)) {
  const list = fs.readdirSync(here, { withFileTypes: true }).filter((d) => d.isDirectory() && /^\d/.test(d.name)).map((d) => d.name);
  console.error(`Usage: node try-project.mjs <project> [dest dir] [--skill-dir <dir>]\nProjects: ${list.join(", ")}`);
  process.exit(2);
}
const name = (fs.readFileSync(path.join(skillDir, "SKILL.md"), "utf8").match(/^name:\s*(\S+)/m) || [])[1];
if (!name) {
  console.error(`No "name:" in ${path.join(skillDir, "SKILL.md")}`);
  process.exit(2);
}

const dest = path.resolve(destArg ?? path.join(os.tmpdir(), `clearspec-try-${project}-${Date.now()}`));
if (fs.existsSync(dest) && fs.readdirSync(dest).length) {
  console.error(`Not empty: ${dest}`);
  process.exit(2);
}
fs.cpSync(src, dest, { recursive: true, filter: (p) => !p.split(path.sep).some((s) => s === "node_modules" || s === ".git") });
const git = (...a) => execFileSync("git", ["-C", dest, ...a], { stdio: "ignore" });
git("init", "-q");
git("add", "-A");
git("-c", "user.name=eval", "-c", "user.email=eval@example.invalid", "commit", "-q", "-m", "Initial scaffold");

const target = path.join(dest, ".claude", "skills", name);
for (const part of ["SKILL.md", "references", "assets", "scripts"]) {
  fs.cpSync(path.join(skillDir, part), path.join(target, part), { recursive: true });
}
console.log(`Ready: ${dest}\nOpen Claude Code there and run /${name} "<your idea>".`);
