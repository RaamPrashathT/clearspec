export type Status = "active" | "paused" | "done";

const styles: Record<Status, string> = {
  active: "bg-pine-tint text-pine-strong",
  paused: "bg-clay-tint text-clay",
  done: "bg-paper text-ink-muted border border-line",
};

export function StatusBadge({ status }: { status: Status }) {
  return <span className={`inline-block rounded-sm px-1.5 py-0.5 text-xs font-medium capitalize ${styles[status]}`}>{status}</span>;
}
