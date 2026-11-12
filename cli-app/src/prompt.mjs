// The first message every agent gets: run the clearspec skill, and how to talk to the developer through this app.
import path from "node:path";

const fwd = (p) => p.split(path.sep).join("/");

export function buildKickoff({ skillDir, projectDir, idea, channel }) {
  const skill = fwd(skillDir);
  const ask = channel === "ask-user-question"
    ? [
        "- Ask every question with your AskUserQuestion tool (1–3 independent questions per call, 2–4 options each, the recommended option first with \"(Recommended)\" in its label). The app renders it as a picker with an \"Other\" field. Option `preview` text (ASCII sketches) is shown next to the options.",
      ]
    : [
        "- Ask every question by calling the `ask_user` tool of the `clearspec` MCP server. Its input has the same shape as AskUserQuestion: `{ questions: [{ question, header, multiSelect, options: [{ label, description, preview? }] }] }`, 1–3 independent questions, 2–4 options each, the recommended option first with \"(Recommended)\" in its label.",
        "- After calling `ask_user`, end your turn at once and write nothing more. The developer's answers arrive as the next user message.",
        "- If you do not have the `ask_user` tool, end your message with a fenced code block whose language is `clearspec-questions` and whose body is that same JSON, then end your turn.",
      ];

  return [
    "You are running the clearspec skill inside the clearspec app, a local web UI. The developer reads your messages there, not in a terminal.",
    "",
    `Skill directory (CLAUDE_SKILL_DIR): ${skill}`,
    `Read ${skill}/SKILL.md now and follow it exactly. Replace every \${CLAUDE_SKILL_DIR} with ${skill}. Read the files under references/ when SKILL.md says to.`,
    `Project directory: ${fwd(projectDir)} (write outputs under ${fwd(projectDir)}/clearspec/).`,
    "",
    "Talking to the developer in this app:",
    ...ask,
    "- Your normal messages (context brief, artifact list, confirm gate, final report) appear as chat with markdown rendered. Keep them short.",
    "- The app shows REQUIREMENTS.md and the mockups live from disk, so do not start serve.mjs and do not ask the developer to open files.",
    "- Never start a long-running process.",
    "",
    "The idea ($ARGUMENTS):",
    idea.trim(),
  ].join("\n");
}

export function formatAnswers(questions, answers) {
  const lines = ["Answers from the developer:"];
  for (const q of questions) {
    const a = answers?.[q.question];
    const text = Array.isArray(a) ? a.join(", ") : a ?? "(no answer)";
    lines.push(`- ${q.header ? `[${q.header}] ` : ""}${q.question}\n  → ${text}`);
  }
  lines.push("", "Continue the skill from here.");
  return lines.join("\n");
}

/** Fallback for agents without MCP: find a ```clearspec-questions block at the end of a message. */
export function extractQuestionBlock(text) {
  const m = /```clearspec-questions\s*\n([\s\S]*?)```/i.exec(text ?? "");
  if (!m) return null;
  try {
    const data = JSON.parse(m[1]);
    const qs = Array.isArray(data) ? data : data.questions;
    return Array.isArray(qs) && qs.length ? qs : null;
  } catch {
    return null;
  }
}
