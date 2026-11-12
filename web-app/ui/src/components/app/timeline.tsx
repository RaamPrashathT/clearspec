import * as React from "react"
import {
  AlertTriangleIcon, BrainIcon, CircleCheckIcon, CircleXIcon, CopyIcon, FileTextIcon, GlobeIcon,
  PencilIcon, SearchIcon, SquareTerminalIcon, UsersIcon, WrenchIcon,
} from "lucide-react"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  MessageScroller, MessageScrollerButton, MessageScrollerContent, MessageScrollerItem,
  MessageScrollerProvider, MessageScrollerViewport,
} from "@/components/ui/message-scroller"
import { Spinner } from "@/components/ui/spinner"
import {
  Trace, TraceCollapsible, TraceCollapsibleContent, TraceCollapsibleTrigger, TraceDescription,
  TraceIcon, TraceLine, TraceTitle,
} from "@/components/ui/trace"
import { EXPLAIN, type Item, type ToolRow } from "@/hooks/use-run"
import { Markdown } from "./markdown"

const live = (s: string) => s === "in_progress" || s === "pending"

function toolIcon(title: string) {
  if (/^Read /.test(title)) return <FileTextIcon />
  if (/^(Write|Edit) /.test(title)) return <PencilIcon />
  if (/^Run /.test(title)) return <SquareTerminalIcon />
  if (/^Web search|^Fetch /.test(title)) return <GlobeIcon />
  if (/^(Search|Find) /.test(title)) return <SearchIcon />
  if (/^Subagent/.test(title)) return <UsersIcon />
  return <WrenchIcon />
}

function summarize(tools: ToolRow[]) {
  const n = (re: RegExp) => tools.filter((t) => re.test(t.title)).length
  const parts = [
    [n(/^Read /), "read"], [n(/^(Write|Edit) /), "wrote"], [n(/^Run /), "ran"],
    [n(/^(Search|Find|Web search|Fetch) /), "searched"], [n(/^Subagent/), "subagents"],
  ].filter(([c]) => c) as [number, string][]
  return parts.map(([c, w]) => `${w} ${c}`).join(", ")
}

/** Consecutive tool calls as one collapsible step: "Working · Read SKILL.md" while live, "6 steps" when done. */
function ToolGroup({ tools }: { tools: ToolRow[] }) {
  const running = tools.filter((t) => live(t.status)).pop()
  const failed = tools.some((t) => t.status === "failed")
  return (
    <Trace>
      <TraceCollapsible>
        <TraceCollapsibleTrigger>
          <TraceLine status={running ? "running" : failed ? "error" : undefined}>
            <TraceIcon>{running ? <Spinner /> : failed ? <CircleXIcon /> : <CircleCheckIcon />}</TraceIcon>
            <TraceTitle>{running ? running.title : `${tools.length} step${tools.length > 1 ? "s" : ""}`}</TraceTitle>
            {!running && <TraceDescription>{summarize(tools)}</TraceDescription>}
          </TraceLine>
        </TraceCollapsibleTrigger>
        <TraceCollapsibleContent keepMounted>
          <Trace>
            {tools.map((t) => (
              <TraceLine key={t.id} status={live(t.status) ? "running" : t.status === "failed" ? "error" : undefined} className={t.sub ? "ps-4" : undefined}>
                <TraceIcon>{toolIcon(t.title)}</TraceIcon>
                <TraceTitle className="font-mono">{t.title}</TraceTitle>
              </TraceLine>
            ))}
          </Trace>
        </TraceCollapsibleContent>
      </TraceCollapsible>
    </Trace>
  )
}

/** Agent reasoning: open and shimmering while it streams, folded once the agent moves on. */
function Thought({ text, active }: { text: string; active: boolean }) {
  const [open, setOpen] = React.useState(active)
  React.useEffect(() => setOpen(active), [active])
  return (
    <Trace>
      <TraceCollapsible open={open} onOpenChange={setOpen}>
        <TraceCollapsibleTrigger>
          <TraceLine status={active ? "running" : undefined}>
            <TraceIcon><BrainIcon /></TraceIcon>
            <TraceTitle>{active ? "Thinking" : "Thought"}</TraceTitle>
          </TraceLine>
        </TraceCollapsibleTrigger>
        <TraceCollapsibleContent>
          <Markdown text={text} className="max-h-60 overflow-y-auto border-s ps-3 text-xs text-muted-foreground" />
        </TraceCollapsibleContent>
      </TraceCollapsible>
    </Trace>
  )
}

function AnswerSummary({ item }: { item: Extract<Item, { kind: "question" }> }) {
  if (item.cancelled || !item.answers) return <p className="text-center text-xs text-muted-foreground">Question cancelled</p>
  return (
    <div className="ms-auto grid max-w-[85%] gap-2 rounded-xl bg-muted px-3.5 py-2.5 text-sm">
      {Object.entries(item.answers).map(([q, a]) => (
        <div key={q} className="grid gap-0.5">
          <span className="text-xs text-muted-foreground">{q}</span>
          <span>{a === EXPLAIN ? "Asked for an example first" : Array.isArray(a) ? a.join(", ") : a}</span>
        </div>
      ))}
    </div>
  )
}

function copy(text: string) {
  navigator.clipboard?.writeText(text).catch(() => {})
}

function Notice({ item, onStop, onSetup }: { item: Extract<Item, { kind: "notice" | "error" }>; onStop: () => void; onSetup: () => void }) {
  const isError = item.kind === "error" || item.severity === "error"
  const title = item.kind === "error" ? (item.tag === "login" ? "Sign-in needed" : item.tag === "budget" ? "Budget reached" : item.tag === "not-installed" ? "Agent not found" : "The run stopped") : item.title
  const body = item.kind === "error" ? item.message : item.description
  const cmd = /`([^`]+)`/.exec(body)?.[1]
  const canStop = item.kind === "notice" && (isError || item.tag === "stall")
  return (
    <Alert variant={isError ? "destructive" : "default"}>
      <AlertTriangleIcon />
      <AlertTitle>{title}</AlertTitle>
      {body && <AlertDescription><pre className="max-h-48 overflow-auto font-mono text-xs whitespace-pre-wrap">{body}</pre></AlertDescription>}
      <AlertAction className="flex flex-wrap gap-1.5">
        {item.tag === "login" && cmd && <Button size="sm" onClick={() => copy(cmd)}><CopyIcon /> Copy `{cmd}`</Button>}
        {canStop && <Button size="sm" variant="outline" onClick={onStop}>Stop run</Button>}
        {(item.kind === "error" || canStop) && <Button size="sm" variant="ghost" onClick={onSetup}>Back to setup</Button>}
        {body && <Button size="sm" variant="ghost" onClick={() => copy(`${title}\n${body}`)}>Copy</Button>}
      </AlertAction>
    </Alert>
  )
}

export function Timeline({ items, busy, working, onStop, onSetup, empty }: {
  items: Item[]
  busy: boolean
  working: string
  onStop: () => void
  onSetup: () => void
  empty?: React.ReactNode
}) {
  const lastThought = [...items].reverse().find((i) => i.kind === "thought")
  const lastIdx = items.length - 1
  return (
    <MessageScrollerProvider autoScroll defaultScrollPosition="end">
      <MessageScroller className="min-h-0 flex-1">
        <MessageScrollerViewport aria-label="Conversation">
          <MessageScrollerContent className="mx-auto w-full max-w-3xl gap-4 px-4 py-6">
            {items.length === 0 && empty}
            {items.map((it, idx) => (
              <MessageScrollerItem key={`${it.kind}-${it.id}`} messageId={`${it.kind}-${it.id}`} scrollAnchor={it.kind === "user"}>
                {it.kind === "sys" && <p className="text-center text-xs text-muted-foreground">{it.text}</p>}
                {it.kind === "user" && <div className="ms-auto w-fit max-w-[85%] rounded-xl bg-muted px-3.5 py-2.5 text-sm whitespace-pre-wrap">{it.text}</div>}
                {it.kind === "agent" && <Markdown text={it.text} className="text-sm" />}
                {it.kind === "thought" && <Thought text={it.text} active={busy && it === lastThought && idx === lastIdx} />}
                {it.kind === "tools" && <ToolGroup tools={it.tools} />}
                {it.kind === "question" && (it.answers === undefined && !it.cancelled
                  ? <p className="text-center text-xs text-primary">Waiting for your answer below…</p>
                  : <AnswerSummary item={it} />)}
                {it.kind === "approval" && (it.resolved === undefined && !it.cancelled
                  ? <p className="text-center text-xs text-primary">Waiting for your approval below…</p>
                  : <p className="text-center text-xs text-muted-foreground">{it.cancelled ? "Approval cancelled" : `${it.title}: ${it.resolved}`}</p>)}
                {(it.kind === "notice" || it.kind === "error") && <Notice item={it} onStop={onStop} onSetup={onSetup} />}
              </MessageScrollerItem>
            ))}
            {busy && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
                <Spinner className="size-3.5 text-primary" />
                <span className="shimmer truncate">{working}</span>
              </div>
            )}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton />
      </MessageScroller>
    </MessageScrollerProvider>
  )
}
