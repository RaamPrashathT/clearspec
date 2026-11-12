#!/usr/bin/env node
// clearspec connect <CODE> --server <url>   pair this computer with the hosted web app and keep it connected
// clearspec connect                         reconnect a computer that is already paired
// Windows needs shell:true to launch .cmd agent shims; Node warns about that. It is expected here.
process.noDeprecation = true;
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : fallback;
};
const pkg = JSON.parse(readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "package.json"), "utf8"));

if (argv.includes("--version") || argv.includes("-v")) {
  console.log(pkg.version);
  process.exit(0);
}

if (argv[0] !== "connect" || argv.includes("--help") || argv.includes("-h")) {
  console.log(`clearspec ${pkg.version}: lets the clearspec web app use the coding agents on this computer.

Usage:
  npx clearspec connect <CODE> --server <url>   pair this computer (the web app shows this command)
  npx clearspec connect                         reconnect a computer that's already paired

Options:
  --server <url>    the clearspec web app to pair with
  --project <dir>   folder runs start in by default (default: current folder)
  -v, --version     print the version
  -h, --help        show this help

Agents: Claude Code, Codex, GitHub Copilot CLI, Cursor Agent, Gemini CLI, OpenCode, or any ACP agent.
It uses the logins you already have. Keep this window open while you use the web app.`);
  process.exit(argv[0] === "connect" || argv.length === 0 || argv.includes("--help") || argv.includes("-h") ? 0 : 1);
}

const { connect } = await import("../src/remote.mjs");
try {
  const code = argv[1] && !argv[1].startsWith("--") ? argv[1] : undefined;
  await connect({ code, server: flag("server", process.env.CLEARSPEC_SERVER), project: flag("project") });
} catch (err) {
  console.error(`\n  ${err.message}\n`);
  process.exit(1);
}
