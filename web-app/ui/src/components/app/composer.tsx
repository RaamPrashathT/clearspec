import * as React from "react"
import { ArrowUpIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { ModelPicker } from "@/components/app/model-picker"
import type { ModelOption } from "@/lib/types"

export type ComposerProps = {
  placeholder: string
  sendLabel: string
  onSend: (text: string) => void | Promise<void>
  disabled?: boolean
  value?: string
  onValueChange?: (v: string) => void
  models?: ModelOption[] | null
  modelsLoading?: boolean
  model?: string
  onModelChange?: (v: string) => void
  efforts?: string[] | null
  effort?: string
  onEffortChange?: (v: string) => void
  budget?: string
  onBudgetChange?: (v: string) => void
}

export function Composer(p: ComposerProps) {
  const [own, setOwn] = React.useState("")
  const value = p.value ?? own
  const setValue = p.onValueChange ?? setOwn
  const ref = React.useRef<HTMLTextAreaElement>(null)
  React.useEffect(() => { ref.current?.focus() }, [])

  const submit = async () => {
    const text = value.trim()
    if (!text || p.disabled) return
    setValue("")
    await p.onSend(text)
  }

  const effortItems = [{ value: "", label: "Effort: default" }, ...(p.efforts ?? []).map((e) => ({ value: e, label: `Effort: ${e}` }))]

  return (
    <form
      className="w-full rounded-2xl border bg-card p-2 shadow-sm focus-within:ring-2 focus-within:ring-ring/30"
      onSubmit={(e) => { e.preventDefault(); submit() }}
    >
      <Textarea
        ref={ref}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit() } }}
        placeholder={p.placeholder}
        rows={2}
        className="max-h-48 min-h-14 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent"
      />
      <div className="flex flex-wrap items-center gap-1.5 px-1 pt-1">
        {p.modelsLoading && (
          <span className="inline-flex items-center gap-1.5 px-2 text-xs text-muted-foreground"><Spinner className="size-3" /> Loading models…</span>
        )}
        {!p.modelsLoading && (p.models ?? []).length > 0 && p.onModelChange && (
          <ModelPicker models={p.models ?? []} value={p.model ?? ""} onChange={p.onModelChange} />
        )}
        {p.efforts && p.efforts.length > 0 && p.onEffortChange && (
          <Select items={effortItems} value={p.effort ?? ""} onValueChange={(v) => p.onEffortChange!(String(v ?? ""))}>
            <SelectTrigger size="sm" aria-label="Reasoning effort"><SelectValue /></SelectTrigger>
            <SelectContent>
              {effortItems.map((e) => <SelectItem key={e.value || "default"} value={e.value}>{e.label}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        {p.onBudgetChange && (
          <label className="inline-flex items-center gap-1 text-xs text-muted-foreground" title="The run stops when it reaches this. Not needed on a subscription login.">
            Limit $
            <Input
              type="number" min={0} step={0.5} inputMode="decimal" placeholder="none"
              value={p.budget ?? ""} onChange={(e) => p.onBudgetChange!(e.target.value)}
              aria-label="Budget limit in US dollars" className="h-7 w-20"
            />
          </label>
        )}
        <span className="flex-1" />
        <Button type="submit" size="sm" disabled={p.disabled || !value.trim()}>
          {p.sendLabel} <ArrowUpIcon />
        </Button>
      </div>
    </form>
  )
}
