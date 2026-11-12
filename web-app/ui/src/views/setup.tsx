import * as React from "react"
import {
  AlertTriangleIcon, ArrowRightIcon, CheckIcon, ChevronDownIcon, CopyIcon, FolderOpenIcon, LogOutIcon, PlusIcon, RefreshCwIcon, Trash2Icon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet, FieldTitle,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Spinner } from "@/components/ui/spinner"
import { api, loadForm, saveForm } from "@/lib/api"
import type { AgentInfo, Config, Connector, Me, Pending, SessionSummary } from "@/lib/types"

/** The four agents this app is built around. Everything else sits under "More agents". */
const FEATURED = ["claude", "codex", "copilot", "cursor"]

function Choice({ value, title, description, badge, disabled }: { value: string; title: React.ReactNode; description: React.ReactNode; badge?: React.ReactNode; disabled?: boolean }) {
  return (
    <FieldLabel htmlFor={`opt-${value}`} className={disabled ? "opacity-60" : undefined}>
      <Field orientation="horizontal">
        <FieldContent>
          <FieldTitle>{title} {badge}</FieldTitle>
          <FieldDescription>{description}</FieldDescription>
        </FieldContent>
        <RadioGroupItem value={value} id={`opt-${value}`} disabled={disabled} />
      </Field>
    </FieldLabel>
  )
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <FieldSet className="gap-3">
      <FieldLegend className="flex items-center gap-2">
        <span className="grid size-5 place-items-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">{n}</span>
        {title}
      </FieldLegend>
      {children}
    </FieldSet>
  )
}

function CopyLine({ text }: { text: string }) {
  const [done, setDone] = React.useState(false)
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-2 ps-3">
      <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap font-mono text-xs" title={text}>{text}</code>
      <Button type="button" size="sm" variant="ghost" onClick={() => { navigator.clipboard?.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500) }}>
        {done ? <CheckIcon /> : <CopyIcon />} {done ? "Copied" : "Copy"}
      </Button>
    </div>
  )
}

/** Pair a computer: show the one-time command, wait until the computer checks in. */
function AddComputer({ known, onPaired, onCancel }: { known: Set<string>; onPaired: (c: Connector) => void; onCancel: () => void }) {
  const [pair, setPair] = React.useState<{ code: string; command: string; expires: number } | null>(null)
  const [error, setError] = React.useState("")
  React.useEffect(() => { api("/api/connectors/pair", {}).then(setPair).catch((e) => setError(e.message)) }, [])
  React.useEffect(() => {
    if (!pair) return
    const t = setInterval(async () => {
      const list = await api<Connector[]>("/api/connectors").catch(() => [])
      const fresh = list.find((c) => !known.has(c.id) && c.online)
      if (fresh) onPaired(fresh)
    }, 2500)
    return () => clearInterval(t)
  }, [pair, known, onPaired])

  return (
    <Card size="sm" className="border-primary/40">
      <CardHeader>
        <CardTitle>Add a computer</CardTitle>
        <CardDescription>Runs use the agent CLIs already installed and signed in on that computer. Nothing is stored here but the pairing.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm">
        {error && <FieldError>{error}</FieldError>}
        {!pair && !error && <Spinner />}
        {pair && (
          <>
            <ol className="grid list-decimal gap-3 ps-5">
              <li className="grid gap-1.5">Open a terminal on that computer and run:<CopyLine text={pair.command} /></li>
              <li>Keep that window open. This page continues as soon as it connects.</li>
            </ol>
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Spinner className="size-3" /> Waiting for the computer… The code works once and expires in 15 minutes. Needs Node.js 20+.
            </p>
          </>
        )}
        <div><Button type="button" size="sm" variant="ghost" onClick={onCancel}>Cancel</Button></div>
      </CardContent>
    </Card>
  )
}

function AgentChoice({ a }: { a: AgentInfo }) {
  const needed = a.installed && a.login === "needed"
  const badge = a.id === "custom" ? undefined
    : !a.installed ? <Badge variant="outline">Not installed</Badge>
    : needed ? <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400">Needs sign-in</Badge>
    : a.login === "unknown" ? <Badge variant="secondary">Installed</Badge>
    : <Badge variant="secondary">Ready</Badge>
  return (
    <Choice
      value={a.id} title={a.name} disabled={!a.installed} badge={badge}
      description={a.id === "custom" ? "Any agent that speaks ACP" : !a.installed ? a.loginHint : needed ? "Sign in on that computer, then check again" : a.login === "unknown" ? "Sign-in can't be checked from here" : "Uses your existing sign-in"}
    />
  )
}

/** Shown under the agent list when the chosen agent is signed out (or can't tell us). */
function LoginNotice({ agent, checking, onCheck }: { agent: AgentInfo; checking: boolean; onCheck: () => void }) {
  if (!agent.installed || agent.id === "custom" || !agent.login || agent.login === "ok") return null
  const needed = agent.login === "needed"
  return (
    <div className={`flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm ${needed ? "border-amber-500/40 bg-amber-500/5" : "bg-muted/40"}`}>
      <AlertTriangleIcon className={`size-4 shrink-0 ${needed ? "text-amber-500" : "text-muted-foreground"}`} />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{needed ? `You're not signed in to ${agent.name}` : `Couldn't check the ${agent.name} sign-in`}</p>
        <p className="text-xs text-muted-foreground">
          {agent.loginHint} {needed ? "Then come back and check again." : "If a run fails with a sign-in error, do this and start again."}
        </p>
      </div>
      <Button type="button" size="sm" variant="outline" onClick={onCheck} disabled={checking}>
        {checking ? <Spinner /> : <RefreshCwIcon />} Check again
      </Button>
    </div>
  )
}

export function Setup({ me, onContinue }: { config: Config; me: Me; onContinue: (p: Pending) => void }) {
  const saved = React.useMemo(loadForm, [])
  const [computers, setComputers] = React.useState<Connector[] | null>(null)
  const [connectorId, setConnectorId] = React.useState<string>(saved.connectorId ?? "")
  const [adding, setAdding] = React.useState(false)
  const [agents, setAgents] = React.useState<AgentInfo[] | null>(null)
  const [checking, setChecking] = React.useState(false)
  const [agentsError, setAgentsError] = React.useState("")
  const [agentId, setAgentId] = React.useState<string>(saved.agentId ?? "claude")
  const [customCommand, setCustomCommand] = React.useState<string>(saved.customCommand ?? "")
  const [showMore, setShowMore] = React.useState(false)
  const [projectDir, setProjectDir] = React.useState<string>("")
  const [error, setError] = React.useState("")
  const [browsing, setBrowsing] = React.useState(false)
  const [runs, setRuns] = React.useState<SessionSummary[]>([])

  const loadComputers = React.useCallback(async () => {
    const list = await api<Connector[]>("/api/connectors").catch(() => [] as Connector[])
    setComputers(list)
    setConnectorId((cur) => (list.some((c) => c.id === cur) ? cur : list.find((c) => c.online)?.id ?? list[0]?.id ?? ""))
    return list
  }, [])

  React.useEffect(() => { loadComputers(); api<SessionSummary[]>("/api/sessions").then(setRuns).catch(() => {}) }, [loadComputers])
  React.useEffect(() => {
    const t = setInterval(loadComputers, 10_000)
    return () => clearInterval(t)
  }, [loadComputers])

  const computer = computers?.find((c) => c.id === connectorId)

  // Which agents are installed on the chosen computer, and whether each is signed in (asked live).
  const loadAgents = React.useCallback(async (fresh: boolean) => {
    if (!computer?.online) return
    try {
      const c = await api<Config>(`/api/connectors/${computer.id}/config`, fresh ? { fresh: true } : {})
      const order = (id: string) => (FEATURED.includes(id) ? FEATURED.indexOf(id) : id === "custom" ? 99 : 50)
      const list = [...c.agents].sort((a, b) => order(a.id) - order(b.id))
      setAgents(list)
      setAgentsError("")
      setAgentId((cur) => (list.find((a) => a.id === cur && a.installed) ? cur : list.find((a) => a.installed && a.id !== "custom")?.id ?? "custom"))
    } catch (e: any) { setAgentsError(e.message) }
  }, [computer?.id, computer?.online])

  React.useEffect(() => {
    setAgents(null)
    setAgentsError("")
    if (!computer?.online) return
    setProjectDir((d) => d || saved.projectDirs?.[computer.id] || computer.cwd)
    loadAgents(false)
  }, [computer?.id, computer?.online]) // eslint-disable-line react-hooks/exhaustive-deps

  async function checkAgain() {
    setChecking(true)
    await loadAgents(true)
    setChecking(false)
  }

  // Coming back from the terminal after signing in: look again by itself.
  React.useEffect(() => {
    const onVisible = () => { if (!document.hidden && agents?.some((a) => a.login === "needed")) loadAgents(true) }
    document.addEventListener("visibilitychange", onVisible)
    return () => document.removeEventListener("visibilitychange", onVisible)
  }, [agents, loadAgents])

  const agent = agents?.find((a) => a.id === agentId)
  const featured = agents?.filter((a) => FEATURED.includes(a.id)) ?? []
  const others = agents?.filter((a) => !FEATURED.includes(a.id)) ?? []
  // Keep a selected "other" agent visible.
  const moreOpen = showMore || (agent && !FEATURED.includes(agent.id))

  async function browse() {
    if (!computer) return
    setBrowsing(true)
    setError("")
    try {
      const r = await api<{ path?: string }>(`/api/connectors/${computer.id}/pick-folder`, { start: projectDir })
      if (r.path) setProjectDir(r.path)
    } catch (e: any) { setError(e.message) }
    finally { setBrowsing(false) }
  }

  async function remove(c: Connector) {
    await api(`/api/connectors/${c.id}/remove`, {}).catch(() => {})
    loadComputers()
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (!computer) return setError("Add a computer first.")
    if (!computer.online) return setError(`${computer.name} is offline. Run \`clearspec connect\` on it.`)
    if (!agent?.installed) return setError("Pick an agent that's installed on that computer.")
    if (agent.login === "needed") return setError(`Sign in to ${agent.name} on that computer first. ${agent.loginHint}`)
    if (agentId === "custom" && !customCommand.trim()) return setError("Enter the agent's ACP launch command.")
    if (!projectDir.trim()) return setError("Choose the project folder on that computer.")
    saveForm({ agentId, connectorId, customCommand, projectDirs: { ...(saved.projectDirs ?? {}), [computer.id]: projectDir.trim() } })
    try { if ("Notification" in window && Notification.permission === "default") Notification.requestPermission() } catch { /* ignore */ }
    onContinue({ agentId, customCommand: customCommand.trim(), projectDir: projectDir.trim(), connectorId: computer.id, connectorName: computer.name })
  }

  const known = React.useMemo(() => new Set((computers ?? []).map((c) => c.id)), [computers])

  return (
    <main className="min-h-0 flex-1 overflow-y-auto">
      <header className="flex h-12 items-center gap-3 border-b px-4">
        <span className="font-heading text-sm font-semibold tracking-tight">clearspec</span>
        <span className="flex-1" />
        <img src={me.avatar} alt="" className="size-6 rounded-full" />
        <span className="text-xs text-muted-foreground">{me.login}</span>
        <Button size="sm" variant="ghost" render={<a href="/auth/logout" />}><LogOutIcon /> Sign out</Button>
      </header>
      <form onSubmit={submit} className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-10">
        <div className="grid gap-1.5">
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-balance">Turn an idea into a spec</h1>
          <p className="text-sm text-muted-foreground">
            clearspec asks only the questions that change what gets built, then writes
            <code className="mx-1 rounded bg-muted px-1 font-mono text-xs">REQUIREMENTS.md</code>and clickable mockups, using the coding agent already on your computer.
          </p>
        </div>

        <Step n={1} title="Which computer?">
          {computers === null && <Spinner />}
          {computers && computers.length > 0 && (
            <RadioGroup value={connectorId} onValueChange={(v) => setConnectorId(String(v))} className="grid gap-2">
              {computers.map((c) => (
                <div key={c.id} className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <Choice value={c.id} title={c.name}
                      badge={c.online ? <Badge>Online</Badge> : <Badge variant="outline">Offline</Badge>}
                      description={c.online ? `${c.platform} · clearspec ${c.version}` : "Run `clearspec connect` on it to bring it online."} />
                  </div>
                  <Button type="button" size="icon-sm" variant="ghost" aria-label={`Remove ${c.name}`} onClick={() => remove(c)}><Trash2Icon /></Button>
                </div>
              ))}
            </RadioGroup>
          )}
          {adding
            ? <AddComputer known={known} onCancel={() => setAdding(false)} onPaired={(c) => { setAdding(false); loadComputers().then(() => setConnectorId(c.id)) }} />
            : (
              <div className="flex gap-2">
                <Button type="button" variant={computers && computers.length ? "outline" : "default"} size="sm" onClick={() => setAdding(true)}><PlusIcon /> Add a computer</Button>
                {computers && computers.length > 0 && <Button type="button" variant="ghost" size="sm" onClick={loadComputers}><RefreshCwIcon /> Refresh</Button>}
              </div>
            )}
        </Step>

        {computer?.online && (
          <Step n={2} title={`Which agent on ${computer.name}?`}>
            {agentsError && <FieldError>{agentsError}</FieldError>}
            {!agents && !agentsError && <p className="flex items-center gap-2 text-xs text-muted-foreground"><Spinner className="size-3" /> Checking which agents are installed…</p>}
            {agents && (
              <RadioGroup value={agentId} onValueChange={(v) => setAgentId(String(v))} className="grid gap-2">
                <div className="grid gap-2 sm:grid-cols-2">{featured.map((a) => <AgentChoice key={a.id} a={a} />)}</div>
                {others.length > 0 && (
                  <>
                    <button type="button" onClick={() => setShowMore((v) => !v)} className="flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                      <ChevronDownIcon className={`size-3.5 transition-transform ${moreOpen ? "rotate-180" : ""}`} /> More agents
                    </button>
                    {moreOpen && <div className="grid gap-2 sm:grid-cols-2">{others.map((a) => <AgentChoice key={a.id} a={a} />)}</div>}
                  </>
                )}
              </RadioGroup>
            )}
            {agent && <LoginNotice agent={agent} checking={checking} onCheck={checkAgain} />}
            {agentId === "custom" && (
              <Field>
                <FieldLabel htmlFor="custom-cmd">ACP launch command</FieldLabel>
                <Input id="custom-cmd" value={customCommand} onChange={(e) => setCustomCommand(e.target.value)} placeholder="e.g. kiro-cli acp" autoComplete="off" />
              </Field>
            )}
          </Step>
        )}

        {computer?.online && (
          <Step n={3} title={`Project folder on ${computer.name}`}>
            <FieldGroup className="flex-row gap-2">
              <Input value={projectDir} onChange={(e) => setProjectDir(e.target.value)} aria-label="Project folder path" placeholder="Choose a folder…" spellCheck={false} className="font-mono text-xs" />
              <Button type="button" variant="outline" onClick={browse} disabled={browsing} title="Opens a folder dialog on that computer">
                {browsing ? <Spinner /> : <FolderOpenIcon />} Browse…
              </Button>
            </FieldGroup>
            <FieldDescription>The spec is written into <code className="font-mono">clearspec/</code> in this folder, and shown here as it's written.</FieldDescription>
          </Step>
        )}

        {error && <FieldError>{error}</FieldError>}
        <div><Button type="submit" size="lg" disabled={!computer?.online || agent?.login === "needed"}>Continue <ArrowRightIcon /></Button></div>

        {runs.length > 0 && (
          <section className="grid gap-2">
            <h2 className="text-sm font-medium">Your runs</h2>
            <ul className="grid gap-1">
              {runs.map((r) => (
                <li key={r.id}>
                  <a href={`#${r.id}`} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted">
                    <span className="truncate">{r.agentName} · {r.idea.slice(0, 70)}</span>
                    <span className="truncate text-xs text-muted-foreground">{r.where}</span>
                    <Badge variant="outline" className="ms-auto">{r.state}</Badge>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
      </form>
    </main>
  )
}
