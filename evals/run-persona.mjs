#!/usr/bin/env node
// Persona eval runner for clearspec.
// Runs one eval case end to end, headless: a "skill" session builds the spec while a "persona" session
// answers as the developer from evals/personas/<file>.md, which the skill session never sees.
// Then a judge scores hidden-requirement recall against the produced REQUIREMENTS.md.
//
// Usage:
//   node run-persona.mjs <case id or name> [--arm skill|none|both] [--max-turns 40] [--budget 20]
//                        [--model <skill model>] [--persona-model sonnet] [--judge-model sonnet]
//                        [--projects <dir>] [--out <dir>] [--skill-dir <dir>]
//
// Arms: "skill" runs the skill; "none" runs the same idea with no skill installed; "both" runs both.
// --skill-dir runs another copy of the skill, such as evals/baselines/baseline-skill-v1, to compare versions.
// The skill is installed under the name in its SKILL.md frontmatter, and the case's slash command is
// rewritten to match, so older versions named spec-it still run.
//
// Each run copies the test project into a fresh git repo under --out, so the test projects stay clean.
// Results: <run dir>/result.json and transcript.md; a one-line summary is printed per arm.

import { spawnSync, execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");
const defaultSkillDir = path.join(repoRoot, "plugins", "clearspec", "skills", "clearspec");

// ---------- Arguments ----------

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : argv[i + 1];
};
const caseArg = argv.find((a, i) => !a.startsWith("--") && !(i > 0 && argv[i - 1].startsWith("--")));
const armArg = flag("arm", "skill");
const arm = armArg === "baseline" ? "none" : armArg; // "baseline" was the old name for the no-skill arm
const maxTurns = Number(flag("max-turns", 40));
const budgetUsd = Number(flag("budget", 20));
const skillModel = flag("model", null);
const personaModel = flag("persona-model", "sonnet");
const judgeModel = flag("judge-model", "sonnet");
const projectsDir = path.resolve(flag("projects", path.join(here, "test-projects")));
const outDir = path.resolve(flag("out", path.join(projectsDir, "_runs")));
const skillDir = path.resolve(flag("skill-dir", defaultSkillDir));

const evals = JSON.parse(fs.readFileSync(path.join(here, "evals.json"), "utf8")).evals;
const testCase = evals.find((e) => String(e.id) === caseArg || e.name === caseArg);
if (!testCase) {
  console.error(`Usage: node run-persona.mjs <case> [--arm skill|none|both] ...\nCases: ${evals.map((e) => `${e.id} ${e.name}`).join(", ")}`);
  process.exit(2);
}
if (!["skill", "none", "both"].includes(arm)) {
  console.error('--arm must be "skill", "none", or "both".');
  process.exit(2);
}

// The installed skill's name decides its folder and its slash command.
const skillName = (fs.readFileSync(path.join(skillDir, "SKILL.md"), "utf8").match(/^name:\s*(\S+)/m) || [])[1];
if (!skillName) {
  console.error(`No "name:" in ${path.join(skillDir, "SKILL.md")}`);
  process.exit(2);
}
const skillPrompt = testCase.prompt.replace(/^\/[\w:-]+/, `/${skillName}`);

// ---------- Claude CLI ----------

// On Windows the npm "claude" is a .cmd shim around claude.exe; call the exe directly so no shell
// parses the arguments. Override with CLAUDE_BIN.
function claudeBin() {
  if (process.env.CLAUDE_BIN) return process.env.CLAUDE_BIN;
  if (process.platform === "win32") {
    const exe = path.join(process.env.APPDATA || "", "npm", "node_modules", "@anthropic-ai", "claude-code", "bin", "claude.exe");
    if (fs.existsSync(exe)) return exe;
  }
  return "claude";
}
const CLAUDE = claudeBin();

// Sends `prompt` on stdin to `claude -p` and returns the parsed JSON result.
function claude(prompt, { cwd, args = [], timeoutMs = 30 * 60 * 1000 }) {
  const res = spawnSync(CLAUDE, ["-p", "--output-format", "json", ...args], {
    cwd,
    input: prompt,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    timeout: timeoutMs,
  });
  if (res.error) throw new Error(`claude failed to start: ${res.error.message}`);
  const out = (res.stdout || "").trim();
  let json;
  try {
    json = JSON.parse(out.slice(out.indexOf("{")));
  } catch {
    throw new Error(`claude returned no JSON (exit ${res.status}): ${(res.stderr || out).slice(0, 800)}`);
  }
  if (json.is_error) throw new Error(`claude error: ${String(json.result || json.subtype).slice(0, 800)}`);
  return json;
}

const usageTokens = (u = {}) =>
  (u.input_tokens || 0) + (u.output_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0);

// ---------- Prompts ----------

const personaText = fs.readFileSync(path.join(here, testCase.persona), "utf8");
const idea = (testCase.prompt.match(/"([^"]+)"/) || [null, testCase.prompt])[1];

const PERSONA_SYSTEM = `You are role-playing a software developer who asked an AI assistant to write a product spec. Follow the persona brief below exactly.

Rules:
- Reply only with what the developer would type: short, plain, first person. No preamble, no markdown headings.
- Answer only from the brief. Reveal a hidden fact only when the assistant's question reaches it. Never list the hidden requirements yourself.
- When the assistant offers lettered or numbered options, answer with the option you choose, for example "B" or "1 yes, 2 B".
- When the assistant asks you to confirm a restate, assumptions, or a plan, confirm it if it fits the brief; otherwise say what to change.
- If you do not understand a question, ask the assistant to explain it.
- When the assistant has finished and is not asking you anything, reply with exactly: DONE

Persona brief:
${personaText}`;

const noSkillPrompt = `I want a product requirements spec for this idea: "${idea}".
Interview me about anything unclear first, one round at a time. Then write REQUIREMENTS.md for a coding agent, plus offline HTML mockups (or an API reference or CLI transcripts if that fits better), into a folder named clearspec/ in this project.`;

const JUDGE_SYSTEM = `You grade whether a product spec captured specific requirements. For each numbered hidden requirement, decide if the spec states it clearly enough that a coding agent would build it: as a functional requirement, an edge case, an acceptance criterion, or an explicit rule. Partial or vague mentions count as not found. Answer with JSON only: an array of {"n": <number>, "found": true|false, "evidence": "<short quote from the spec or empty>"}.`;

// ---------- Run one arm ----------

function cloneProject(dest, withSkill) {
  const src = path.join(projectsDir, testCase.project);
  if (!fs.existsSync(src)) throw new Error(`Test project not found: ${src}`);
  // Copy the scaffold and commit it, so the skill sees an ordinary git project.
  fs.cpSync(src, dest, { recursive: true, filter: (p) => !p.split(path.sep).some((s) => s === "node_modules" || s === ".git") });
  const git = (...a) => execFileSync("git", ["-C", dest, ...a], { stdio: "ignore" });
  git("init", "-q");
  git("add", "-A");
  git("-c", "user.name=eval", "-c", "user.email=eval@example.invalid", "commit", "-q", "-m", "Initial scaffold");
  if (withSkill) {
    const target = path.join(dest, ".claude", "skills", skillName);
    fs.mkdirSync(target, { recursive: true });
    for (const part of ["SKILL.md", "references", "assets", "scripts"]) {
      fs.cpSync(path.join(skillDir, part), path.join(target, part), { recursive: true });
    }
  }
}

function findFiles(dir, name, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name === ".git") continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) findFiles(p, name, acc);
    else if (e.name === name) acc.push(p);
  }
  return acc;
}

function hiddenRequirements() {
  const section = personaText.split(/^## Hidden requirements.*$/m)[1] || "";
  // "(twist)" marks a requirement that goes against the usual default, so prior art alone won't find it.
  return [...section.matchAll(/^\s*(\d+)\.\s+(.+)$/gm)].map((m) => {
    const raw = m[2].trim();
    const twist = /^\(twist\)\s*/i.test(raw);
    return { n: Number(m[1]), text: raw.replace(/^\(twist\)\s*/i, ""), twist };
  });
}

/** Share of a set of hidden requirements the judge found, or null when the set is empty. */
function recallOf(hidden, grades) {
  if (!hidden.length) return null;
  return hidden.filter((h) => grades.find((g) => g.n === h.n && g.found)).length / hidden.length;
}

function runArm(armName) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const variant = armName === "skill" && skillDir !== defaultSkillDir ? `-${path.basename(skillDir)}` : "";
  const runDir = path.join(outDir, `${testCase.id}-${testCase.name}-${armName}${variant}-${stamp}`);
  const work = path.join(runDir, "project");
  fs.mkdirSync(runDir, { recursive: true });
  cloneProject(work, armName === "skill");

  const skillArgs = [
    "--permission-mode", "acceptEdits",
    "--allowedTools", "Bash(node:*)", "Bash(git:*)", "Bash(ls:*)", "Bash(mkdir:*)", "Bash(cp:*)", "WebSearch", "WebFetch",
    "--setting-sources", "project",
    ...(skillModel ? ["--model", skillModel] : []),
  ];
  const personaArgs = ["--tools", "", "--model", personaModel, "--system-prompt", PERSONA_SYSTEM, "--setting-sources", "project"];

  const transcript = [];
  const log = (who, text) => {
    transcript.push(`## ${who}\n\n${text}\n`);
    fs.writeFileSync(path.join(runDir, "transcript.md"), transcript.join("\n"));
  };

  const totals = { costUsd: 0, tokens: 0, durationMs: 0, skillTurns: 0 };
  const add = (r) => {
    totals.costUsd += r.total_cost_usd || 0;
    totals.tokens += usageTokens(r.usage);
    totals.durationMs += r.duration_ms || 0;
  };

  let skillSession = null;
  let personaSession = null;
  let message = armName === "skill" ? skillPrompt : noSkillPrompt;
  let stop = "max-turns";
  let error = null;

  try {
    for (let turn = 1; turn <= maxTurns; turn++) {
      log(turn === 1 ? "Developer (opening prompt)" : "Developer", message);
      const s = claude(message, { cwd: work, args: [...skillArgs, ...(skillSession ? ["--resume", skillSession] : [])] });
      skillSession = s.session_id;
      totals.skillTurns = turn;
      add(s);
      log("Assistant", s.result || "(no text)");
      process.stdout.write(`  turn ${turn}: $${totals.costUsd.toFixed(2)}\r`);
      if (totals.costUsd >= budgetUsd) {
        stop = "budget";
        break;
      }

      const p = claude(`The assistant wrote:\n\n${s.result || "(no text)"}\n\nYour reply as the developer:`, {
        cwd: os.tmpdir(),
        args: [...personaArgs, ...(personaSession ? ["--resume", personaSession] : [])],
        timeoutMs: 5 * 60 * 1000,
      });
      personaSession = p.session_id;
      add(p);
      message = (p.result || "").trim();
      if (/^DONE\.?$/i.test(message)) {
        stop = "done";
        log("Developer", "DONE");
        break;
      }
    }
  } catch (e) {
    stop = "error";
    error = e.message;
  }
  process.stdout.write("\n");

  // ---------- Score ----------

  const specs = findFiles(work, "REQUIREMENTS.md");
  const specPath = specs.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0] || null;
  const hidden = hiddenRequirements();
  let recall = null;
  let grades = [];
  if (specPath && hidden.length) {
    const spec = fs.readFileSync(specPath, "utf8").slice(0, 150000);
    try {
      const j = claude(
        `Hidden requirements:\n${hidden.map((h) => `${h.n}. ${h.text}`).join("\n")}\n\nSpec:\n<spec>\n${spec}\n</spec>`,
        { cwd: os.tmpdir(), args: ["--tools", "", "--model", judgeModel, "--system-prompt", JUDGE_SYSTEM, "--setting-sources", "project", "--no-session-persistence"] }
      );
      add(j);
      const raw = String(j.result || "");
      grades = JSON.parse(raw.slice(raw.indexOf("["), raw.lastIndexOf("]") + 1));
      recall = grades.filter((g) => g.found).length / hidden.length;
    } catch (e) {
      error = (error ? error + " | " : "") + `judge: ${e.message}`;
    }
  }

  let check = null;
  if (specPath) {
    const r = spawnSync(process.execPath, [path.join(skillDir, "scripts", "check.mjs"), path.dirname(specPath), "--json"], { encoding: "utf8" });
    try {
      const j = JSON.parse(r.stdout);
      check = { errors: j.totals.errors, warnings: j.totals.warnings, counts: j.counts };
    } catch {
      check = { unparsable: (r.stdout || r.stderr || "").slice(0, 300) };
    }
  }

  const unit = specPath ? path.dirname(specPath) : null;
  const decisions = unit ? [path.join(unit, "decisions.md"), path.join(unit, "01-decisions.md")].find((f) => fs.existsSync(f)) : null;
  // Old layouts tag questions Qn in decisions.md; the current layout logs asked decisions in the spec's
  // ## Decisions table (provenance own, accepted, or assumed; fact rows were never asked).
  let questions = null;
  if (decisions) questions = new Set(fs.readFileSync(decisions, "utf8").match(/\bQ\d+\b/g) || []).size;
  else if (specPath) {
    const body = fs.readFileSync(specPath, "utf8");
    const log = body.slice(Math.max(0, body.search(/^##\s+\d*\.?\s*Decision(?:s|\s+log)\b/im)));
    questions = (log.match(/^\|\s*D-\d+\s*\|.*\|\s*(own|accepted|assumed)\s*\|/gim) || []).length;
  }

  const result = {
    case: testCase.name,
    arm: armName,
    project: testCase.project,
    stop,
    error,
    skillTurns: totals.skillTurns,
    questions,
    recall,
    standardRecall: recallOf(hidden.filter((h) => !h.twist), grades),
    twistRecall: recallOf(hidden.filter((h) => h.twist), grades),
    found: grades.filter((g) => g.found).map((g) => g.n),
    missed: hidden.filter((h) => !grades.find((g) => g.n === h.n && g.found)).map((h) => `${h.n}. ${h.text}`),
    check,
    costUsd: Number(totals.costUsd.toFixed(4)),
    tokens: totals.tokens,
    minutes: Number((totals.durationMs / 60000).toFixed(1)),
    spec: specPath ? path.relative(runDir, specPath) : null,
    grades,
  };
  fs.writeFileSync(path.join(runDir, "result.json"), JSON.stringify(result, null, 2) + "\n");

  const fmt = (r) => (r == null ? "n/a" : `${Math.round(r * 100)}%`);
  const pct = `${fmt(recall)} (standard ${fmt(result.standardRecall)}, twist ${fmt(result.twistRecall)})`;
  const chk = check && "errors" in check ? `${check.errors} errors` : "no check";
  console.log(
    `${testCase.name} [${armName}] stop=${stop} turns=${totals.skillTurns} questions=${questions ?? "n/a"} recall=${pct} check=${chk} cost=$${result.costUsd} time=${result.minutes}m\n  ${path.relative(process.cwd(), runDir)}` +
      (error ? `\n  error: ${error}` : "")
  );
  return result;
}

for (const a of arm === "both" ? ["skill", "none"] : [arm]) runArm(a);
