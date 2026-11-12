import * as React from "react"
import { notify } from "@/lib/api"
import type { Limit, ModelOption, Output, Question, ServerEvent, SessionSummary } from "@/lib/types"

export type ToolRow = { id: string; title: string; status: string; sub?: boolean }

export type Item =
  | { kind: "sys"; id: string; text: string }
  | { kind: "user"; id: string; text: string }
  | { kind: "agent"; id: string; text: string }
  | { kind: "thought"; id: string; text: string }
  | { kind: "tools"; id: string; tools: ToolRow[] }
  | { kind: "question"; id: string; questions: Question[]; nums: number[]; answers?: Record<string, string | string[]> | null; cancelled?: boolean }
  | { kind: "approval"; id: string; title: string; detail: string; options: { id: string; name: string; kind?: string }[]; resolved?: string | null; cancelled?: boolean }
  | { kind: "notice"; id: string; severity: string; title: string; description: string; tag?: string }
  | { kind: "error"; id: string; message: string; tag?: string }

export type RunState = {
  session: SessionSummary | null
  status: string
  detail: string
  items: Item[]
  phase: number
  qCount: number
  qNums: Record<string, number>
  outputs: Output[]
  models: { current: string; options: ModelOption[] } | null
  limits: Limit[]
  usage: { costUsd: number; inputTokens: number; outputTokens: number; contextUsed?: number; contextSize?: number; budgetUsd?: number | null } | null
  working: string
  connected: boolean
}

export const PHASES = ["Context", "Questions", "Confirm", "Spec", "Mockups", "Check"] as const

const initial: RunState = {
  session: null, status: "starting", detail: "", items: [], phase: 0, qCount: 0, qNums: {},
  outputs: [], models: null, limits: [], usage: null, working: "Starting the agent…", connected: false,
}

export const EXPLAIN =
  "Please explain this question first: what it decides, one short scenario with real names and numbers, and what each option would mean in practice. Then ask me the same question again."

type Action = { type: "reset" } | { type: "event"; e: ServerEvent } | { type: "hello"; session: SessionSummary; events: ServerEvent[] } | { type: "phase"; phase: number } | { type: "closed" }

const advance = (s: RunState, phase: number) => (phase > s.phase ? { ...s, phase } : s)

function replaceItem(items: Item[], id: string, kind: Item["kind"], fn: (it: any) => Item): Item[] {
  const i = items.findIndex((x) => x.id === id && x.kind === kind)
  if (i < 0) return items
  const copy = items.slice()
  copy[i] = fn(items[i])
  return copy
}

function apply(s: RunState, e: ServerEvent): RunState {
  switch (e.type) {
    case "status":
      return { ...s, status: e.state, detail: e.detail ?? "" }
    case "text": {
      if (e.role === "system") return { ...s, items: [...s.items, { kind: "sys", id: `s${e.seq}`, text: e.text }] }
      if (e.role === "user") return { ...s, items: [...s.items, { kind: "user", id: `u${e.seq}`, text: e.text }] }
      return phaseFromText({ ...s, working: "Writing…", items: [...s.items, { kind: "agent", id: e.id, text: e.text }] }, e.text)
    }
    case "text-delta": {
      const last = s.items[s.items.length - 1]
      if (last?.kind === "agent" && last.id === e.id) {
        const text = last.text + e.text
        return phaseFromText({ ...s, working: "Writing…", items: [...s.items.slice(0, -1), { ...last, text }] }, text)
      }
      return { ...s, working: "Writing…", items: [...s.items, { kind: "agent", id: e.id, text: e.text }] }
    }
    case "thought":
    case "thought-delta": {
      const last = s.items[s.items.length - 1]
      if (last?.kind === "thought" && last.id === e.id) {
        return { ...s, working: "Thinking…", items: [...s.items.slice(0, -1), { ...last, text: last.text + e.text }] }
      }
      return { ...s, working: "Thinking…", items: [...s.items, { kind: "thought", id: e.id, text: e.text }] }
    }
    case "tool": {
      const row: ToolRow = { id: e.id, title: e.title, status: e.status, sub: e.sub }
      const last = s.items[s.items.length - 1]
      const items: Item[] = last?.kind === "tools"
        ? [...s.items.slice(0, -1), { ...last, tools: [...last.tools, row] }]
        : [...s.items, { kind: "tools", id: `g${e.seq}`, tools: [row] }]
      return phaseFromTool({ ...s, working: e.title, items }, e.title)
    }
    case "tool-update": {
      const items = s.items.map((it) => it.kind === "tools" && it.tools.some((t) => t.id === e.id)
        ? { ...it, tools: it.tools.map((t) => (t.id === e.id ? { ...t, status: e.status, title: e.title ?? t.title } : t)) }
        : it)
      return { ...s, items }
    }
    case "question": {
      // A question asked again (e.g. after "Explain") keeps its number.
      const qNums = { ...s.qNums }
      let qCount = s.qCount
      const nums = (e.questions as Question[]).map((q) => qNums[q.question] ?? (qNums[q.question] = ++qCount))
      return advance({ ...s, qNums, qCount, items: [...s.items, { kind: "question", id: e.id, questions: e.questions, nums }] }, 1)
    }
    case "question-answered":
      return { ...s, items: replaceItem(s.items, e.id, "question", (it) => ({ ...it, answers: e.value ?? null, cancelled: Boolean(e.cancelled) || !e.value })) }
    case "approval":
      return { ...s, items: [...s.items, { kind: "approval", id: e.id, title: e.title, detail: e.detail ?? "", options: e.options }] }
    case "approval-resolved":
      return { ...s, items: replaceItem(s.items, e.id, "approval", (it) => ({ ...it, resolved: e.value ?? null, cancelled: Boolean(e.cancelled) || !e.value })) }
    case "notice":
      return { ...s, items: [...s.items, { kind: "notice", id: `n${e.seq}`, severity: e.severity, title: e.title, description: e.description ?? "", tag: e.kind }] }
    case "error":
      return { ...s, items: [...s.items, { kind: "error", id: `e${e.seq}`, message: e.message, tag: e.kind }] }
    case "outputs": {
      const next = { ...s, outputs: e.outputs as Output[] }
      return (e.outputs as Output[]).some((o) => o.screens.length) ? advance(next, 4) : next
    }
    case "models":
      return { ...s, models: { current: e.current ?? "", options: e.options } }
    case "limits":
      return { ...s, limits: e.limits }
    case "usage":
      return { ...s, usage: { costUsd: e.costUsd, inputTokens: e.inputTokens, outputTokens: e.outputTokens, contextUsed: e.contextUsed, contextSize: e.contextSize, budgetUsd: e.budgetUsd } }
    default:
      return s
  }
}

function phaseFromText(s: RunState, text: string) {
  return /\bA-\d+\b/.test(text) && /confirm/i.test(text) ? advance(s, 2) : s
}

function phaseFromTool(s: RunState, title = "") {
  if (/check\.mjs/.test(title)) return advance(s, 5)
  if (/mockups[\\/]/.test(title) && /^(Write|Edit)/.test(title)) return advance(s, 4)
  return s
}

function reducer(s: RunState, a: Action): RunState {
  switch (a.type) {
    case "reset": return initial
    case "hello": return a.events.reduce(apply, { ...initial, session: a.session, status: a.session.state, connected: true })
    case "event": return apply(s, a.e)
    case "phase": return advance(s, a.phase)
    case "closed": return { ...s, connected: false }
  }
}

/** Live state of one run, fed by the server's WebSocket (history replays on connect). */
export function useRun(id: string | null) {
  const [state, dispatch] = React.useReducer(reducer, initial)

  React.useEffect(() => {
    dispatch({ type: "reset" })
    if (!id) return
    const ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws?session=${id}`)
    ws.onmessage = (m) => {
      const e = JSON.parse(m.data) as ServerEvent
      if (e.type === "hello") return dispatch({ type: "hello", session: e.session, events: e.events })
      dispatch({ type: "event", e })
      if (e.type === "question") notify("clearspec needs your answer", e.questions?.[0]?.question ?? "")
      if (e.type === "approval") notify("clearspec needs your approval", e.title)
      if (e.type === "error") notify("clearspec stopped", String(e.message).split("\n")[0])
    }
    ws.onclose = () => dispatch({ type: "closed" })
    return () => ws.close()
  }, [id])

  const setPhase = React.useCallback((phase: number) => dispatch({ type: "phase", phase }), [])
  return { state, setPhase }
}

/** The question or approval still waiting on the developer, if any. */
export function pendingItem(items: Item[]) {
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i]
    if (it.kind === "question" && it.answers === undefined && !it.cancelled) return it
    if (it.kind === "approval" && it.resolved === undefined && !it.cancelled) return it
  }
  return null
}
