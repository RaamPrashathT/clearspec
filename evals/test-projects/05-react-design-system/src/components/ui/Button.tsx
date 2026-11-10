import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger";

const styles: Record<Variant, string> = {
  primary: "bg-pine text-white hover:bg-pine-strong",
  secondary: "bg-surface text-ink border border-line hover:bg-paper",
  danger: "bg-surface text-danger border border-line hover:bg-clay-tint",
};

export function Button({ variant = "primary", className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${styles[variant]} ${className}`} {...props} />;
}
