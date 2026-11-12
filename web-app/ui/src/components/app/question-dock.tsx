import * as React from "react"
import { LightbulbIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Questionnaire, QuestionnaireActions, QuestionnaireChoice, QuestionnaireChoiceDescription,
  QuestionnaireChoices, QuestionnaireDescription, QuestionnaireError, QuestionnaireInput,
  QuestionnaireItem, QuestionnaireNext, QuestionnairePrevious, QuestionnaireProgress,
  QuestionnaireSubmit, QuestionnaireTitle,
} from "@/components/ui/questionnaire"
import { Badge } from "@/components/ui/badge"
import { api } from "@/lib/api"
import { EXPLAIN, type Item } from "@/hooks/use-run"

type QuestionItem = Extract<Item, { kind: "question" }>
type ApprovalItem = Extract<Item, { kind: "approval" }>

/**
 * The agent's question batch, one question at a time, in place of the message box.
 * Number keys pick options (Questionnaire shortcuts); Enter moves on; the last step sends every answer.
 */
export function QuestionDock({ runId, item }: { runId: string; item: QuestionItem }) {
  const [sending, setSending] = React.useState(false)
  const [previews, setPreviews] = React.useState<Record<number, string>>({})
  const items = React.useMemo(() => item.questions.map((q, i) => ({
    name: `q${i}`,
    required: true,
    choices: q.options.map((o) => ({ value: o.label })),
  })), [item.questions])

  async function send(answers: Record<string, string | string[]>) {
    setSending(true)
    try { await api(`/api/sessions/${runId}/answer`, { id: item.id, value: answers }) }
    catch { setSending(false) }
  }

  function onSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault()
    const data = new FormData(ev.currentTarget)
    const answers: Record<string, string | string[]> = {}
    item.questions.forEach((q, i) => {
      const values = data.getAll(`q${i}`).map(String).filter(Boolean)
      answers[q.question] = q.multiSelect ? values : values[values.length - 1] ?? ""
    })
    send(answers)
  }

  const explain = () => send(Object.fromEntries(item.questions.map((q) => [q.question, EXPLAIN])))
  const total = item.questions.length

  return (
    <Card className="w-full gap-3 border-primary/40 py-4 shadow-lg">
      <CardHeader className="px-4">
        <CardTitle className="flex items-center gap-2 text-xs font-normal text-muted-foreground">
          Question {item.nums[0]}{total > 1 ? `–${item.nums[total - 1]}` : ""}
          <span aria-hidden="true">·</span> clearspec usually asks 5–12
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4">
        <Questionnaire key={item.id} items={items} onSubmit={onSubmit} shortcuts="numbers" className="gap-3">
          {total > 1 && <QuestionnaireProgress />}
          {item.questions.map((q, qi) => (
            <QuestionnaireItem key={qi} name={`q${qi}`} required multiple={Boolean(q.multiSelect)}>
              <QuestionnaireTitle className="flex flex-wrap items-center gap-2 text-sm font-medium">
                {q.header && <Badge variant="secondary">{q.header}</Badge>}
                <span>{q.question}</span>
              </QuestionnaireTitle>
              {q.multiSelect && <QuestionnaireDescription>Pick all that apply.</QuestionnaireDescription>}
              <div className={previews[qi] ? "grid gap-3 lg:grid-cols-2" : "grid"}>
                <QuestionnaireChoices>
                  {q.options.map((o) => (
                    <QuestionnaireChoice
                      key={o.label}
                      value={o.label}
                      onChange={() => o.preview && setPreviews((p) => ({ ...p, [qi]: o.preview! }))}
                      onPointerEnter={() => o.preview && setPreviews((p) => ({ ...p, [qi]: o.preview! }))}
                    >
                      <span className="font-medium">{o.label}</span>
                      {o.description && <QuestionnaireChoiceDescription>{o.description}</QuestionnaireChoiceDescription>}
                    </QuestionnaireChoice>
                  ))}
                  <QuestionnaireInput aria-label="Other answer" placeholder="Other: type your own answer" />
                </QuestionnaireChoices>
                {previews[qi] && (
                  <pre className="max-h-72 overflow-auto rounded-lg bg-muted p-3 font-mono text-[11px] leading-snug">{previews[qi]}</pre>
                )}
              </div>
              <QuestionnaireError />
            </QuestionnaireItem>
          ))}
          <QuestionnaireActions>
            <Button type="button" variant="ghost" size="sm" onClick={explain} disabled={sending}>
              <LightbulbIcon /> Explain with an example
            </Button>
            <span className="flex-1" />
            <QuestionnairePrevious />
            <QuestionnaireNext />
            <QuestionnaireSubmit disabled={sending}>{total > 1 ? "Send answers" : "Answer"}</QuestionnaireSubmit>
          </QuestionnaireActions>
        </Questionnaire>
      </CardContent>
    </Card>
  )
}

export function ApprovalDock({ runId, item }: { runId: string; item: ApprovalItem }) {
  const [busy, setBusy] = React.useState(false)
  const choose = async (value: string) => {
    setBusy(true)
    try { await api(`/api/sessions/${runId}/answer`, { id: item.id, value }) } catch { setBusy(false) }
  }
  return (
    <Card className="w-full gap-3 border-primary/40 py-4 shadow-lg">
      <CardHeader className="px-4"><CardTitle className="text-sm">{item.title}</CardTitle></CardHeader>
      {item.detail && (
        <CardContent className="px-4">
          <pre className="max-h-48 overflow-auto rounded-lg bg-muted p-3 font-mono text-xs whitespace-pre-wrap">{item.detail}</pre>
        </CardContent>
      )}
      <CardFooter className="justify-end gap-2 px-4">
        {item.options.map((o) => (
          <Button key={o.id} size="sm" disabled={busy} variant={o.kind?.startsWith("allow") ? "default" : "outline"} onClick={() => choose(o.id)}>
            {o.name}
          </Button>
        ))}
      </CardFooter>
    </Card>
  )
}
