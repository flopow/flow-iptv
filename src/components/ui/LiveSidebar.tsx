import Link from "next/link";

export interface LiveCategory {
  category: string;
  count: number;
}

interface LiveSidebarProps {
  baseHref: string;
  categories: LiveCategory[];
  active: string | null;
  total: number;
}

// Sidebar lateral: categorias dos canais ao vivo, no mesmo padrão
// da aba Filmes (Plataformas). "Todos" lista tudo.
export function LiveSidebar({ baseHref, categories, active, total }: LiveSidebarProps) {
  const items = [
    { id: null, label: `Todos · ${total}` },
    ...categories.map((c) => ({ id: c.category, label: `${c.category} · ${c.count}` })),
  ];

  return (
    <aside className="shrink-0">
      <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted">
        Categorias
      </h2>
      <nav className="flex flex-col gap-1" aria-label="Categorias de canais ao vivo">
        {items.map((item) => {
          const href = item.id ? `${baseHref}?categoria=${encodeURIComponent(item.id)}` : baseHref;
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
    </aside>
  );
}
