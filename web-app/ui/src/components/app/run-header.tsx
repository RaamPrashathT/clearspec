import { CheckIcon } from "lucide-react"
import { cn } from "cn"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { PHASES } from "@/hooks/use-run"
import { fmtK, resetText } from "@/lib/api"
import type { Limit } from "@/lib/types"

const STATUS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  starting: { label: "Starting", variant: "secondary" },
  running: { label: "Working", variant: "secondary" },
  waiting: { label: "Needs you", variant: "default" },
  idle: { label: "Your turn", variant: "default" },
  done: { label: "Done", variant: "outline" },
  stopped: { label: "Stopped", variant: "outline" },
  error: { label: "Error", variant: "destructive" },
  draft: { label: "New", variant: "outline" },
}

export function LimitBar({ limit, compact }: { limit: Limit; compact?: boolean }) {
  const tone = limit.percent >= 90 ? "bg-destructive" : limit.percent >= 70 ? "bg-amber-500" : "bg-primary"
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex items-center gap-1.5 text-xs whitespace-nowrap text-muted-foreground" />}>
        <span className="text-foreground">{limit.label}</span>
        <span className="h-1.5 w-12 overflow-hidden rounded-full bg-muted" aria-hidden="true">
          <span className={cn("block h-full", tone)} style={{ width: `${Math.min(100, limit.percent)}%` }} />
        </span>
        <span className="tabular-nums">{limit.percent}%</span>
        {!compact && <span>{resetText(limit.resetsAt)}</span>}
      </TooltipTrigger>
      <TooltipContent>{limit.label} plan usage · {resetText(limit.resetsAt)}</TooltipContent>
    </Tooltip>
  )
}

export function Stepper({ phase, done }: { phase: number; done: boolean }) {
  return (
    <ol className="flex items-center gap-1 overflow-x-auto text-xs [scrollbar-width:none]" aria-label="Progress">
      {PHASES.map((name, i) => {
        const complete = i < phase || done
        const now = i === phase && !done
        return (
          <li key={name} className="flex items-center gap-1" aria-current={now ? "step" : undefined} title={name}>
            {i > 0 && <span className="mx-1 h-px w-3 bg-border" aria-hidden="true" />}
            <span className={cn(
              "flex size-5 items-center justify-center rounded-full border text-[10px] tabular-nums",
              complete && "border-primary bg-primary text-primary-foreground",
              now && "border-primary text-primary",
            )}>
              {complete ? <CheckIcon className="size-3" /> : i + 1}
            </span>
            <span className={cn("whitespace-nowrap text-muted-foreground", (complete || now) && "text-foreground", now && "font-medium", !now && "max-md:hidden")}>{name}</span>
          </li>
        )
      })}
    </ol>
  )
}

export function RunHeader(p: {
  title: string
  subtitle?: string
  status: string
  limits: Limit[]
  usage: { costUsd: number; inputTokens: number; outputTokens: number; contextUsed?: number; contextSize?: number; budgetUsd?: number | null } | null
  onHome: () => void
}) {
  const st = STATUS[p.status] ?? { label: p.status, variant: "secondary" as const }
  const u = p.usage
  const budget = u?.budgetUsd ?? null
  const tokens = (u?.inputTokens ?? 0) + (u?.outputTokens ?? 0)
  const warn = Boolean(budget && u && u.costUsd >= 0.8 * budget)
  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b px-4">
      <button onClick={p.onHome} className="font-heading text-sm font-semibold tracking-tight" title="New spec">clearspec</button>
      <span className="truncate text-xs text-muted-foreground" title={p.subtitle}>{p.title}</span>
      <Badge variant={st.variant}>{st.label}</Badge>
      <span className="flex-1" />
      <div className="hidden items-center gap-3 lg:flex">
        {p.limits.filter((l) => !l.label.includes("·")).map((l) => <LimitBar key={l.label} limit={l} compact />)}
      </div>
      {u && (u.costUsd > 0 || tokens > 0) && (
        <span className={cn("text-xs whitespace-nowrap text-muted-foreground tabular-nums", warn && "font-medium text-amber-600 dark:text-amber-400")}>
          {u.costUsd > 0 && (budget ? `$${u.costUsd.toFixed(2)} of $${budget.toFixed(2)}` : `$${u.costUsd.toFixed(2)}`)}
          {u.costUsd > 0 && tokens > 0 && " · "}
          {tokens > 0 && `${fmtK(tokens)} tokens`}
          {u.contextSize ? ` · context ${Math.round((100 * (u.contextUsed ?? 0)) / u.contextSize)}%` : ""}
        </span>
      )}
    </header>
  )
}
