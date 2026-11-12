import * as React from "react"
import { LaptopIcon, ShieldCheckIcon, FileTextIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { api } from "@/lib/api"
import type { Config, Me, Pending } from "@/lib/types"
import { Setup } from "@/views/setup"
import { DraftView, RunView } from "@/views/run"

function useHash() {
  const [hash, setHash] = React.useState(() => location.hash.slice(1))
  React.useEffect(() => {
    const on = () => setHash(location.hash.slice(1))
    window.addEventListener("hashchange", on)
    return () => window.removeEventListener("hashchange", on)
  }, [])
  return hash
}

const GithubIcon = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
)

function SignIn() {
  return (
    <main className="m-auto flex max-w-md flex-col items-center gap-6 px-6 py-16 text-center">
      <div className="grid gap-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">clearspec</h1>
        <p className="text-sm text-muted-foreground text-balance">
          Turn an idea into a REQUIREMENTS.md a coding agent can build from, plus clickable mockups. It asks only the questions that change what gets built.
        </p>
      </div>
      <Button size="lg" render={<a href="/auth/login" />}><GithubIcon /> Sign in with GitHub</Button>
      <ul className="grid gap-2 text-start text-xs text-muted-foreground">
        <li className="flex gap-2"><LaptopIcon className="size-4 shrink-0" /> Runs with the agent already on your computer: Claude Code, Codex, GitHub Copilot CLI or Cursor</li>
        <li className="flex gap-2"><ShieldCheckIcon className="size-4 shrink-0" /> No API key. Your agent logins never leave your computer</li>
        <li className="flex gap-2"><FileTextIcon className="size-4 shrink-0" /> Specs and mockups are written into your project folder and previewed here</li>
      </ul>
      <p className="text-xs text-muted-foreground">We only read your public GitHub profile (name and avatar).</p>
    </main>
  )
}

/** Routes: "" setup · "#new" type the idea · "#<runId>" a live run. Signed-out visitors see the sign-in page. */
export function App() {
  const hash = useHash()
  const [me, setMe] = React.useState<Me | null | undefined>(undefined)
  const [config, setConfig] = React.useState<Config | null>(null)
  const [error, setError] = React.useState("")
  // The setup choices live in memory only; reloading #new returns to setup.
  const [pending, setPending] = React.useState<Pending | null>(null)

  React.useEffect(() => {
    api<Me>("/api/me")
      .then((u) => { setMe(u); return api<Config>("/api/config").then(setConfig) })
      .catch((e) => (e.message === "unauthorized" ? setMe(null) : setError(e.message)))
  }, [])
  React.useEffect(() => { if (hash === "new" && !pending && config) location.hash = "" }, [hash, pending, config])

  const home = () => { location.hash = "" }

  let body: React.ReactNode
  if (error) body = <p className="m-auto max-w-md p-6 text-center text-sm text-muted-foreground">{error}</p>
  else if (me === null) body = <SignIn />
  else if (!me || !config) body = <Spinner className="m-auto size-6" />
  else if (hash === "new" && pending) body = <DraftView config={config} pending={pending} onHome={home} onStarted={(id) => { setPending(null); location.hash = id }} />
  else if (hash && hash !== "new") body = <RunView key={hash} runId={hash} onHome={home} />
  else body = <Setup config={config} me={me} onContinue={(p) => { setPending(p); location.hash = "new" }} />

  return (
    <TooltipProvider>
      <div className="flex h-dvh flex-col bg-background text-foreground">{body}</div>
    </TooltipProvider>
  )
}

export default App
