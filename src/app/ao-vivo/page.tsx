import type { Metadata } from "next";
import Link from "next/link";

import { channelCategories, listChannels } from "@/lib/live";

export const metadata: Metadata = { title: "Ao Vivo" };

export const revalidate = 600; // 10min

interface AoVivoPageProps {
  searchParams: Promise<{ categoria?: string }>;
}

export default async function AoVivoPage({ searchParams }: AoVivoPageProps) {
  const sp = await searchParams;
  const categoria = sp.categoria ?? "";

  const [channels, cats] = await Promise.all([
    listChannels().catch(() => []),
    channelCategories().catch(() => []),
  ]);
  const filtered = categoria ? channels.filter((c) => c.category === categoria) : channels;

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6">
      <header className="mb-8">
        <h1 className="text-2xl font-black tracking-tight text-ink sm:text-3xl">Ao Vivo</h1>
        <p className="mt-1 text-sm text-muted">
          {filtered.length} {filtered.length === 1 ? "canal" : "canais"} de TV ao vivo
        </p>
      </header>

      {/* Categorias */}
      <div className="mb-6 flex flex-wrap gap-2">
        <Link
          href="/ao-vivo"
          className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
            !categoria ? "bg-accent text-white" : "bg-surface-strong text-muted hover:text-ink"
          }`}
        >
          Todos
        </Link>
        {cats.map((cat) => {
          const isActive = cat.category === categoria;
          return (
            <Link
              key={cat.category}
              href={`/ao-vivo?categoria=${encodeURIComponent(cat.category)}`}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                isActive
                  ? "bg-accent text-white"
                  : "bg-surface-strong text-muted hover:text-ink"
              }`}
            >
              {cat.category} · {cat.count}
            </Link>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface py-16 text-center">
          <p className="text-sm text-muted">Nenhum canal nesta categoria.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filtered.map((channel) => (
            <Link
              key={channel.id}
              href={`/ao-vivo/${channel.id}`}
              className="group relative block overflow-hidden rounded-xl border border-line bg-surface shadow-sm transition-all hover:-translate-y-1 hover:border-accent-line hover:shadow-md"
            >
              <div className="relative aspect-video w-full bg-gradient-to-br from-accent-soft via-surface to-surface-strong">
                {channel.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={channel.logo}
                    alt=""
                    className="h-full w-full object-contain p-4"
                    loading="lazy"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-4xl font-black text-accent/60">
                    {channel.name.trim().charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="absolute right-2 top-2 flex items-center gap-1.5 rounded-md bg-black/70 px-2 py-1 text-[11px] font-bold text-white">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                  AO VIVO
                </span>
              </div>
              <div className="px-3 py-2.5">
                <p className="truncate text-sm font-semibold text-foreground" title={channel.name}>
                  {channel.name}
                </p>
                <p className="mt-0.5 truncate text-xs text-muted">{channel.category}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
