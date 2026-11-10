import type { ReactNode } from "react";

const nav = [
  { href: "#projects", label: "Projects" },
  { href: "#clients", label: "Clients" },
  { href: "#settings", label: "Settings" },
];

export function AppShell({ current, children }: { current: string; children: ReactNode }) {
  return (
    <div className="grid min-h-screen grid-cols-[13rem_1fr]">
      <aside className="border-r border-line bg-surface px-4 py-5">
        <p className="mb-6 font-semibold tracking-tight">Plotline</p>
        <nav aria-label="Main">
          <ul className="flex flex-col gap-1">
            {nav.map((item) => (
              <li key={item.href}>
                <a href={item.href} aria-current={item.label === current ? "page" : undefined} className="block rounded-sm px-2 py-1 text-sm text-ink-muted hover:text-ink aria-[current=page]:bg-pine-tint aria-[current=page]:text-pine-strong">
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
      <main className="px-8 py-6">{children}</main>
    </div>
  );
}
