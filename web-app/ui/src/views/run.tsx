import * as React from "react"
import { cn } from "cn"
import { SparklesIcon, SquareIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Composer } from "@/components/app/composer"
import { PreviewPane } from "@/components/app/preview-pane"
import { ApprovalDock, QuestionDock } from "@/components/app/question-dock"
import { LimitBar, RunHeader, Stepper } from "@/components/app/run-header"
import { Timeline } from "@/components/app/timeline"
import { pendingItem, useRun } from "@/hooks/use-run"
import { api, baseName, loadForm, saveForm } from "@/lib/api"
import type { Config, ModelOption, Pending, ProbeInfo } from "@/lib/types"

const EXAMPLES = [
  "An app for roommates to split shared bills and see who owes whom",
  "A webhook relay API: customers register endpoints and we deliver signed events with retries",
  "A CLI that cleans up merged git branches safely",
]

/** Before a run exists: type the idea, pick model / effort / limit. The live probe lists this agent's real models. */
export function DraftView({ config, pending, onStarted, onHome }: { config: Config; pending: Pending; onStarted: (id: string) => void; onHome: () => void }) {
  const isClaudeSdk = pending.agentId === "claude"
  const who = config.agents.find((a) => a.id === pending.agentId)?.name ?? "Agent"
  const key = pending.agentId
  const [info, setInfo] = React.useState<ProbeInfo | null>(null)
  const [model, setModel] = React.useState("")
  const [effort, setEffort] = React.useState<string>(loadForm().effort ?? "")
  const [budget, setBudget] = React.useState<string>(loadForm().budget ?? "")
  const [idea, setIdea] = React.useState("")
  const [error, setError] = React.useState("")
  const [starting, setStarting] = React.useState(false)

  React.useEffect(() => {
    let off = false
    api<ProbeInfo>("/api/agent-info", pending).catch((e) => ({ error: e.message, models: [], limits: [] } as ProbeInfo)).then((r) => {
      if (off) return
      let models: ModelOption[] = r.models ?? []
      if (!models.length && isClaudeSdk) models = config.claudeModels.filter((m) => m.value).map((m) => ({ ...m, efforts: null }))
      const savedModel = loadForm().models?.[key]
      const pick = [savedModel, isClaudeSdk ? "opus" : null, r.currentModel, models[0]?.value].find((v) => v && models.some((m) => m.value === v)) ?? ""
      setInfo({ ...r, models })
      setModel(pick)
    })
    return () => { off = true }
  }, [pending, isClaudeSdk, key, config])

  const efforts = info?.models.find((m) => m.value === model)?.efforts ?? info?.efforts ?? null

  async function start(text: string) {
    setStarting(true)
    setError("")
    const e = efforts?.includes(effort) ? effort : ""
    saveForm({ models: { ...(loadForm().models ?? {}), ...(model ? { [key]: model } : {}) }, effort: e, budget })
    try {
      const s = await api<{ id: string }>("/api/sessions", { ...pending, idea: text, model, effort: e, budgetUsd: Number(budget) || undefined })
      onStarted(s.id)
    } catch (err: any) {
      setIdea(text)
      setError(err.message)
      setStarting(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <RunHeader title={`${who} on ${pending.connectorName} · ${baseName(pending.projectDir)}`} subtitle={pending.projectDir} status="draft" limits={info?.limits ?? []} usage={null} onHome={onHome} />
      <div className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-4">
        <Empty className="my-auto max-w-2xl border-0">
          <EmptyHeader>
            <EmptyMedia variant="icon"><SparklesIcon /></EmptyMedia>
            <EmptyTitle className="text-xl">What do you want to spec?</EmptyTitle>
            <EmptyDescription>
              Describe the idea in a few sentences, or paste a half-written requirement. The agent reads your project first,
              then asks only the questions that change what gets built.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent className="max-w-xl">
            {info && (info.account?.plan || info.agent || info.limits.length > 0) && (
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
                {info.account?.plan && <Badge variant="secondary">{info.account.plan}</Badge>}
                {info.agent && <Badge variant="outline">{info.agent.title ?? info.agent.name}{info.agent.version ? ` ${info.agent.version}` : ""}</Badge>}
                {info.limits.map((l) => <LimitBar key={l.label} limit={l} />)}
              </div>
            )}
            {info?.error && <p className="text-xs text-muted-foreground">Couldn't read agent info: {info.error.split("\n")[0]}</p>}
            {info?.note && <p className="text-xs text-muted-foreground">{info.note}</p>}
            <div className="grid w-full gap-1.5">
              {EXAMPLES.map((t) => (
                <Button key={t} type="button" variant="outline" size="sm" className="h-auto justify-start py-2 text-start whitespace-normal" onClick={() => setIdea(t)}>{t}</Button>
              ))}
            </div>
          </EmptyContent>
        </Empty>
      </div>
      <div className="mx-auto w-full max-w-3xl shrink-0 px-4 pb-4">
        {error && <p className="mb-2 text-xs text-destructive">{error}</p>}
        <Composer
          placeholder="Describe your idea (Enter to start, Shift+Enter for a new line)"
          sendLabel="Start" onSend={start} disabled={starting}
          value={idea} onValueChange={setIdea}
          models={info?.models ?? null} modelsLoading={!info} model={model} onModelChange={setModel}
          efforts={efforts} effort={efforts?.includes(effort) ? effort : ""} onEffortChange={setEffort}
          budget={budget} onBudgetChange={setBudget}
        />
      </div>
    </div>
  )
}

export function RunView({ runId, onHome }: { runId: string; onHome: () => void }) {
  const { state, setPhase } = useRun(runId)
  const s = state.session
  const pending = pendingItem(state.items)
  const busy = ["running", "starting"].includes(state.status) && !pending
  const showPreview = state.phase >= 3
  const onConfirmed = React.useCallback(() => setPhase(3), [setPhase])

  // Tab title tells you when it's your move, even from another tab.
  React.useEffect(() => {
    document.title = state.status === "waiting" ? "● Needs you · clearspec" : state.status === "idle" ? "● Your turn · clearspec" : busy ? "Working… · clearspec" : "clearspec"
    return () => { document.title = "clearspec" }
  }, [state.status, busy])

  const stop = () => api(`/api/sessions/${runId}/stop`, {}).catch(() => {})
  const send = (text: string) => { api(`/api/sessions/${runId}/message`, { text }).catch(() => {}) }
  const switchModel = (value: string) => { api(`/api/sessions/${runId}/model`, { value }).catch(() => {}) }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <RunHeader
        title={s ? `${s.agentName} · ${s.where ?? "your computer"}${s.projectDir ? ` · ${baseName(s.projectDir)}` : ""}` : "Connecting…"}
        subtitle={s?.projectDir}
        status={state.connected ? state.status : "starting"}
        limits={state.limits} usage={state.usage}
        onHome={onHome}
      />
      <div className={cn("grid min-h-0 flex-1", showPreview ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]" : "grid-cols-1")}>
        <section className="flex min-h-0 min-w-0 flex-col">
          <div className="shrink-0 border-b px-4 py-2.5"><div className="mx-auto max-w-3xl"><Stepper phase={state.phase} done={state.status === "done" && state.phase >= 5} /></div></div>
          <Timeline items={state.items} busy={busy} working={state.status === "starting" ? "Starting the agent…" : state.working} onStop={stop} onSetup={onHome} />
          <div className="mx-auto w-full max-w-3xl shrink-0 px-4 pb-4">
            {pending?.kind === "question" && <QuestionDock key={pending.id} runId={runId} item={pending} />}
            {pending?.kind === "approval" && <ApprovalDock key={pending.id} runId={runId} item={pending} />}
            {pending && <div className="mt-2 flex justify-end"><Button size="sm" variant="ghost" onClick={stop}><SquareIcon /> Stop run</Button></div>}
            {!pending && (
              <Composer
                placeholder="Reply to the agent (Enter to send, Shift+Enter for a new line)"
                sendLabel="Send" onSend={send} running={busy} onStop={stop}
                models={state.models?.options ?? null} model={state.models?.current ?? ""}
                onModelChange={state.models && state.models.options.length > 1 ? switchModel : undefined}
              />
            )}
          </div>
        </section>
        {showPreview && (
          <section className="hidden min-h-0 min-w-0 flex-col border-s lg:flex">
            <PreviewPane runId={runId} outputs={state.outputs} onConfirmed={onConfirmed} />
          </section>
        )}
        {/* Watch the spec even while the pane is hidden, so "Confirmed" opens it. */}
        {!showPreview && state.outputs.length > 0 && <SpecWatcher runId={runId} outputs={state.outputs} onConfirmed={onConfirmed} />}
      </div>
    </div>
  )
}

function SpecWatcher({ runId, outputs, onConfirmed }: { runId: string; outputs: { name: string; requirements: { mtime: number } | null }[]; onConfirmed: () => void }) {
  const spec = outputs[outputs.length - 1]
  const mtime = spec?.requirements?.mtime
  React.useEffect(() => {
    if (!spec?.requirements) return
    fetch(`/files/${runId}/${encodeURIComponent(spec.name)}/REQUIREMENTS.md`).then((r) => (r.ok ? r.text() : "")).then((t) => {
      if (/Status:\s*\**Confirmed/i.test(t)) onConfirmed()
    })
  }, [runId, spec?.name, mtime, onConfirmed])
  return null
}
