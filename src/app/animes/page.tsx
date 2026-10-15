import type { Metadata } from "next";

import { PosterCard } from "@/components/ui/PosterCard";
import { SearchBar } from "@/components/ui/SearchBar";
import { countAnimes, listAnimes } from "@/lib/anime";

export const metadata: Metadata = { title: "Animes" };

export const revalidate = 1800; // 30min

interface AnimesPageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function AnimesPage({ searchParams }: AnimesPageProps) {
  const sp = await searchParams;
  const q = sp.q ?? "";

  const [items, total] = await Promise.all([
    listAnimes(q, 60).catch(() => []),
    countAnimes().catch(() => 0),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6">
      <header className="mb-8">
        <h1 className="text-2xl font-black tracking-tight text-ink sm:text-3xl">Animes</h1>
        <p className="mt-1 text-sm text-muted">
          {q
            ? `${items.length} ${items.length === 1 ? "título" : "títulos"} encontrados`
            : `${total} ${total === 1 ? "anime" : "animes"} no catálogo`}
        </p>
        <SearchBar defaultValue={sp.q ?? ""} className="mt-4 max-w-md" action="/animes" />
      </header>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface py-16 text-center">
          <p className="text-sm text-muted">
            {q ? `Nenhum anime encontrado para "${q}".` : "Nenhum anime no catálogo ainda."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {items.map((anime) => (
            <PosterCard
              key={anime.id}
              href={`/animes/${anime.id}`}
              title={anime.title}
              posterUrl={anime.posterUrl}
              badge="Anime"
              subtitle={[anime.year, anime.episodeCount ? `${anime.episodeCount} eps` : null]
                .filter(Boolean)
                .join(" · ")}
            />
          ))}
        </div>
      )}
    </div>
  );
}
