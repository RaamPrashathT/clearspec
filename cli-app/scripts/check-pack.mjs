// Fails `npm pack` / `npm publish` unless the tarball holds what should ship: the helper and the skill.
import { execSync } from "node:child_process";

const out = execSync("npm pack --dry-run --json --ignore-scripts", { encoding: "utf8" });
const [info] = JSON.parse(out);
const files = info.files.map((f) => f.path.replaceAll("\\", "/"));

const banned = [
  [/(^|\/)node_modules\//, "node_modules"],
  [/^test\//, "tests"],
  [/^skill\/evals\//, "skill evals"],
  [/(^|\/)\.env/, "env files"],
];
const problems = files.flatMap((f) => banned.filter(([re]) => re.test(f)).map(([, why]) => `${f}  (${why})`));
const required = ["bin/clearspec.mjs", "src/remote.mjs", "src/server.mjs", "skill/SKILL.md"];
const missing = required.filter((r) => !files.includes(r));

if (problems.length || missing.length) {
  if (problems.length) console.error("Should not ship:\n  " + problems.join("\n  "));
  if (missing.length) console.error("Missing from the package:\n  " + missing.join("\n  "));
  process.exit(1);
}
console.log(`check-pack: ok, ${files.length} files, ${(info.size / 1024).toFixed(0)} kB packed.`);
