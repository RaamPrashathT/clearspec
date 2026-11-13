// Copy ../skills/clearspec into cli-app/skill/ so the published package carries its own copy of the skill.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "..", "skills", "clearspec");
const dest = path.join(root, "skill");

if (!fs.existsSync(path.join(src, "SKILL.md"))) {
  console.error(`No skill at ${src}`);
  process.exit(1);
}
fs.rmSync(dest, { recursive: true, force: true });
fs.cpSync(src, dest, { recursive: true, filter: (p) => !p.split(path.sep).includes("evals") && !p.endsWith("README.md") });
console.log(`Copied ${src} → ${dest}`);
