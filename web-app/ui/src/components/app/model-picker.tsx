import * as React from "react"
import { CheckIcon, ChevronDownIcon, SearchIcon } from "lucide-react"
import { cn } from "cn"
import type { ModelOption } from "@/lib/types"

const SUGGESTED_MAX = 8
const SHORT_LIST = 8 // at or below this many models: a plain list, no search

/** "claude-opus-5-5" and "claude-opus-4-8" are one family; "gpt-5.6-sol" is "gpt-sol". Version numbers are dropped. */
const family = (name: string) => name.toLowerCase().split(/[\s_-]+/).filter((t) => !/^\d+(\.\d+)*$/.test(t)).join("-") || name

/** Auto / default first, then the first (newest-listed) model of each family. */
function suggested(models: ModelOption[], current: string): ModelOption[] {
  const out: ModelOption[] = []
  const seen = new Set<string>()
  const take = (m: ModelOption) => { if (!out.includes(m)) out.push(m) }
  const auto = models.find((m) => m.value === "" || /^(auto|default)$/i.test(m.name))
  if (auto) take(auto)
  for (const m of models) {
    const f = family(m.name)
    if (seen.has(f)) continue
    seen.add(f)
    if (out.length < SUGGESTED_MAX) take(m)
  }
  const cur = models.find((m) => m.value === current)
  if (cur) take(cur)
  return out
}

/** A model dropdown that stays usable with 40+ entries: a few suggestions, search, and the full list on demand. */
export function ModelPicker({ models, value, onChange }: { models: ModelOption[]; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [showAll, setShowAll] = React.useState(false)
  const root = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false) }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey) }
  }, [open])

  const current = models.find((m) => m.value === value)
  const long = models.length > SHORT_LIST
  const q = query.trim().toLowerCase()
  const matches = q ? models.filter((m) => `${m.name} ${m.value}`.toLowerCase().includes(q)) : []
  const top = long ? suggested(models, value) : models
  const rest = models.filter((m) => !top.includes(m))

  const pick = (m: ModelOption) => { onChange(m.value); setOpen(false); setQuery("") }
  const Row = ({ m }: { m: ModelOption }) => (
    <button
      type="button" role="option" aria-selected={m.value === value} title={m.description} onClick={() => pick(m)}
      className={cn("flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-start text-xs hover:bg-muted", m.value === value && "bg-muted")}
    >
      <span className="truncate">{m.name}</span>
      {m.value === value && <CheckIcon className="size-3.5 shrink-0" />}
    </button>
  )

  return (
    <div ref={root} className="relative">
      <button
        type="button" aria-label="Model" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)}
        className="inline-flex h-6 max-w-56 items-center gap-1.5 rounded-md border border-input bg-input/20 px-2 text-xs whitespace-nowrap transition-colors hover:bg-input/40 focus-visible:ring-2 focus-visible:ring-ring/30 dark:bg-input/30"
      >
        <span className="truncate">{current?.name ?? "Model"}</span>
        <ChevronDownIcon className="size-3.5 shrink-0 text-muted-foreground" />
      </button>
      {open && (
        <div role="listbox" className="absolute bottom-full left-0 z-50 mb-2 flex max-h-80 w-64 flex-col overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-lg">
          {long && (
            <label className="flex shrink-0 items-center gap-2 border-b px-2.5 py-2">
              <SearchIcon className="size-3.5 text-muted-foreground" />
              <input
                autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${models.length} models…`}
                className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
              />
            </label>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto p-1">
            {q ? (
              matches.length ? matches.map((m) => <Row key={m.value} m={m} />) : <p className="px-2 py-3 text-xs text-muted-foreground">No model matches “{query}”.</p>
            ) : (
              <>
                {long && <p className="px-2 pt-1 pb-0.5 text-[11px] font-medium text-muted-foreground">Suggested</p>}
                {top.map((m) => <Row key={m.value} m={m} />)}
                {long && rest.length > 0 && (
                  <>
                    <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-1 flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted">
                      <ChevronDownIcon className={cn("size-3.5 transition-transform", showAll && "rotate-180")} /> All models ({models.length})
                    </button>
                    {showAll && rest.map((m) => <Row key={m.value} m={m} />)}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
