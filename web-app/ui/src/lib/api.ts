import { marked } from "marked"

/** JSON call to the local server. The launch token lives in an HttpOnly cookie, so no headers are needed. */
export async function api<T = any>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, body === undefined ? {} : {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
  return data as T
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!)

// Raw HTML in agent output is shown as text, never executed.
marked.use({ renderer: { html: (t: any) => esc(typeof t === "string" ? t : t.text) } })

export const md = (text: string) => marked.parse(text ?? "", { async: false }) as string

export const baseName = (p: string) => String(p).split(/[\\/]/).filter(Boolean).pop() ?? p

export function loadForm(): Record<string, any> {
  try { return JSON.parse(localStorage.getItem("clearspec.form") ?? "{}") } catch { return {} }
}
export function saveForm(patch: Record<string, any>) {
  try { localStorage.setItem("clearspec.form", JSON.stringify({ ...loadForm(), ...patch })) } catch { /* private mode */ }
}

export function resetText(iso: string | null) {
  if (!iso) return ""
  const d = new Date(iso)
  const mins = Math.round((d.getTime() - Date.now()) / 60000)
  if (mins < 60) return `resets in ${Math.max(mins, 0)} min`
  if (mins < 1440) return `resets in ${Math.round(mins / 60)} h`
  return `resets ${d.toLocaleDateString([], { weekday: "short" })}`
}

export const fmtK = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(n))

export function notify(title: string, body: string) {
  if (!document.hidden) return
  try {
    if ("Notification" in window && Notification.permission === "granted") {
      const n = new Notification(title, { body, tag: "clearspec" })
      n.onclick = () => { window.focus(); n.close() }
    }
  } catch { /* unsupported */ }
}
