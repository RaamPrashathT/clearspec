import * as React from "react"
import { ExternalLinkIcon, FileTextIcon, LayoutTemplateIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Output } from "@/lib/types"
import { Markdown } from "./markdown"

const fileUrl = (runId: string, rel: string) => `/files/${runId}/${rel.split("/").map(encodeURIComponent).join("/")}`

/** REQUIREMENTS.md and the mockups, read live from disk. Only this run's spec folders are listed. */
export function PreviewPane({ runId, outputs, onConfirmed }: { runId: string; outputs: Output[]; onConfirmed: () => void }) {
  const [specName, setSpecName] = React.useState<string>("")
  const [screen, setScreen] = React.useState<string>("")
  const [text, setText] = React.useState<string>("")
  const [tab, setTab] = React.useState<string>("spec")
  const [reload, setReload] = React.useState(0)

  const spec = outputs.find((o) => o.name === specName) ?? outputs[outputs.length - 1]
  const screens = spec ? (spec.mockupEntry ? [spec.mockupEntry, ...spec.screens.filter((s) => s !== spec.mockupEntry)] : spec.screens) : []
  const current = screens.includes(screen) ? screen : screens[0]
  const mtime = spec?.requirements?.mtime

  React.useEffect(() => {
    if (!spec?.requirements) return
    let off = false
    fetch(fileUrl(runId, `${spec.name}/REQUIREMENTS.md`)).then((r) => (r.ok ? r.text() : "")).then((t) => {
      if (off) return
      setText(t)
      if (/Status:\s*\**Confirmed/i.test(t)) onConfirmed()
    })
    return () => { off = true }
  }, [runId, spec?.name, mtime, onConfirmed])

  // Reload the mockup when files change on disk.
  React.useEffect(() => { setReload((n) => n + 1) }, [JSON.stringify(outputs)])

  const specItems = outputs.map((o) => ({ value: o.name, label: o.name }))
  const screenItems = screens.map((s) => ({ value: s, label: s.split("/").pop()! }))

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(String(v))} className="flex min-h-0 flex-1 flex-col gap-0">
      <div className="flex h-11 shrink-0 items-center gap-2 border-b px-3">
        <TabsList>
          <TabsTrigger value="spec"><FileTextIcon /> Spec</TabsTrigger>
          <TabsTrigger value="mockups"><LayoutTemplateIcon /> Mockups</TabsTrigger>
        </TabsList>
        {outputs.length > 1 && (
          <Select items={specItems} value={spec?.name ?? ""} onValueChange={(v) => setSpecName(String(v))}>
            <SelectTrigger size="sm" aria-label="Spec folder"><SelectValue /></SelectTrigger>
            <SelectContent>{specItems.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
          </Select>
        )}
        {tab === "mockups" && screens.length > 0 && (
          <Select items={screenItems} value={current} onValueChange={(v) => setScreen(String(v))}>
            <SelectTrigger size="sm" aria-label="Screen"><SelectValue /></SelectTrigger>
            <SelectContent>{screenItems.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
          </Select>
        )}
        <span className="flex-1" />
        {tab === "mockups" && current && (
          <Button size="sm" variant="ghost" render={<a href={fileUrl(runId, current)} target="_blank" rel="noreferrer" />}>
            Open <ExternalLinkIcon />
          </Button>
        )}
      </div>
      <TabsContent value="spec" className="min-h-0 flex-1 overflow-y-auto">
        {text
          ? <Markdown text={text} className="mx-auto max-w-3xl px-6 py-6 text-sm" />
          : <Empty><EmptyHeader><EmptyMedia variant="icon"><FileTextIcon /></EmptyMedia><EmptyTitle>No spec yet</EmptyTitle><EmptyDescription>REQUIREMENTS.md shows up here once it's written.</EmptyDescription></EmptyHeader></Empty>}
      </TabsContent>
      <TabsContent value="mockups" className="min-h-0 flex-1">
        {current
          ? <iframe key={`${current}-${reload}`} title="Mockup preview" src={fileUrl(runId, current)} className="size-full border-0 bg-white" />
          : <Empty><EmptyHeader><EmptyMedia variant="icon"><LayoutTemplateIcon /></EmptyMedia><EmptyTitle>No mockups yet</EmptyTitle><EmptyDescription>They appear here once the agent builds them.</EmptyDescription></EmptyHeader></Empty>}
      </TabsContent>
    </Tabs>
  )
}
