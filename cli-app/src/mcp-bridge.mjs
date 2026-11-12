#!/usr/bin/env node
// Stdio MCP server the app injects into ACP agents. One tool, ask_user, forwards questions to the web UI.
// It returns at once (no long wait, so no MCP tool timeouts); the answers arrive as the agent's next user turn.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const { CLEARSPEC_URL, CLEARSPEC_TOKEN, CLEARSPEC_SESSION } = process.env;

const option = z.object({
  label: z.string().describe("1–5 words. Put \"(Recommended)\" at the end of the recommended option."),
  description: z.string().describe("What happens if chosen."),
  preview: z.string().optional().describe("Optional ASCII sketch or code shown next to the option."),
});
const question = z.object({
  question: z.string().describe("One full sentence that makes sense on its own."),
  header: z.string().max(12).describe("Topic chip, at most 12 characters."),
  multiSelect: z.boolean().default(false),
  options: z.array(option).min(2).max(4),
});

const server = new McpServer({ name: "clearspec", version: "0.1.0" });

server.registerTool(
  "ask_user",
  {
    title: "Ask the developer",
    description: "Show 1–3 multiple-choice questions to the developer in the clearspec app. An \"Other\" free-text field is added automatically. After calling this, END YOUR TURN immediately; the answers arrive as the next user message.",
    inputSchema: { questions: z.array(question).min(1).max(4) },
  },
  async ({ questions }) => {
    try {
      const res = await fetch(`${CLEARSPEC_URL}/internal/ask`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-clearspec-token": CLEARSPEC_TOKEN },
        body: JSON.stringify({ session: CLEARSPEC_SESSION, questions }),
      });
      if (!res.ok) throw new Error(`app answered ${res.status}`);
    } catch (err) {
      return { isError: true, content: [{ type: "text", text: `Could not reach the clearspec app: ${err.message}` }] };
    }
    return {
      content: [{ type: "text", text: "The questions are now on the developer's screen. End your turn now and write nothing else; their answers will arrive as the next user message." }],
    };
  },
);

await server.connect(new StdioServerTransport());
