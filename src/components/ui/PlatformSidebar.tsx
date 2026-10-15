import Link from "next/link";

import { STREAM_PLATFORMS, hasStreamKey } from "@/lib/stream";

interface PlatformSidebarProps {
  baseHref: string;
  active: string | null;
}

// Sidebar lateral: plataformas de streaming (TMDB). "Todos" volta ao
// catálogo local; cada plataforma mostra os títulos disponíveis nela.
export function PlatformSidebar({ baseHref, active }: PlatformSidebarProps) {
  const items = [
    { id: null, label: "Todos" },
    ...STREAM_PLATFORMS.map((p) => ({ id: p.id, label: p.label })),
  ];

  return (
    <aside className="shrink-0">
      <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted">
        Plataformas
      </h2>
      <nav className="flex flex-col gap-1" aria-label="Plataformas de streaming">
        {items.map((item) => {
          const href = item.id ? `${baseHref}?plataforma=${item.id}` : baseHref;
          const isActive = active === item.id;
          return (
            <Link
              key={item.id ?? "todos"}
              href={href}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                isActive
                  ? "bg-accent text-white"
                  : "text-muted hover:bg-surface-strong hover:text-ink"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      {!hasStreamKey() ? (
        <p className="mt-3 px-3 text-[11px] leading-snug text-muted">
          Configure <code className="rounded bg-surface px-1">TMDB_API_KEY</code> para ativar.
        </p>
      ) : null}
    </aside>
  );
}
