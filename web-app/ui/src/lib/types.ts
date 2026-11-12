// Shapes shared with the Node server (src/server.mjs, src/session.mjs).

export type AgentInfo = {
  id: string
  name: string
  kind: "claude-sdk" | "copilot-sdk" | "acp"
  loginHint: string
  command: string | null
  installed: boolean
  /** Sign-in state, asked of the CLI itself. "unknown" when the CLI has no status command (Copilot). Absent from older helpers. */
  login?: "ok" | "needed" | "unknown"
}

export type Config = {
  hosted?: boolean
  server?: string
  skillDir: string
  defaultProject: string
  agents: AgentInfo[]
  claudeModels: { value: string; name: string; description: string }[]
}

export type ModelOption = { value: string; name: string; description?: string; efforts?: string[] | null }

export type Limit = { label: string; percent: number; resetsAt: string | null }

export type ProbeInfo = {
  source?: string
  models: ModelOption[]
  currentModel?: string | null
  efforts?: string[] | null
  account?: { plan: string | null; organization: string | null; provider: string | null } | null
  agent?: { name?: string; title?: string; version?: string } | null
  limits: Limit[]
  /** A line to show under the idea box, e.g. "Copilot chooses the model for you". */
  note?: string
  error?: string
}

export type SessionSummary = {
  id: string
  agent: string
  agentName: string
  projectDir: string
  idea: string
  model: string
  budgetUsd: number | null
  state: string
  createdAt: string
  where?: string
}

export type Question = {
  question: string
  header?: string
  multiSelect?: boolean
  options: { label: string; description?: string; preview?: string }[]
}

export type Output = {
  name: string
  requirements: { mtime: number } | null
  mockupEntry: string | null
  screens: string[]
}

/** Everything needed to start a run, chosen on the setup page. Held in memory only. */
export type Pending = {
  agentId: string
  projectDir: string
  customCommand?: string
  /** Which paired computer runs it. */
  connectorId: string
  connectorName: string
}

// Raw events from the server's WebSocket.
export type ServerEvent = { seq?: number; at?: number; type: string; [k: string]: any }

export type Me = { uid: string; login: string; name: string; avatar: string }

/** A computer paired with `clearspec connect`. */
export type Connector = {
  id: string
  name: string
  platform: string
  version: string
  cwd: string
  online: boolean
  lastSeen: number
  createdAt: number
}
