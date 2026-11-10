import type { InputHTMLAttributes } from "react";

export function Input({ label, id, error, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; id: string; error?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-ink">{label}</label>
      <input id={id} aria-invalid={Boolean(error)} className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm text-ink aria-invalid:border-danger" {...props} />
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
