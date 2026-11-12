import { cn } from "cn"
import { md } from "@/lib/api"

/** Agent markdown. HTML inside it is escaped by the renderer (see lib/api.ts). */
export function Markdown({ text, className }: { text: string; className?: string }) {
  return <div className={cn("prose-chat", className)} dangerouslySetInnerHTML={{ __html: md(text) }} />
}
