import type { Metadata } from "next";
import Link from "next/link";

import { PosterCard } from "@/components/ui/PosterCard";
import { SearchBar } from "@/components/ui/SearchBar";
import { animeCategories, listAnimeByType } from "@/lib/anime";

export const metadata: Metadata = { title: "Animes" };

export const revalidate = 1800; // 30min

const TYPE_LABELS: Record<string, string> = {
  TV: "Séries TV",
  MOVIE: "Filmes",
  OVA: "OVA",
  ONA: "ONA",
  SPECIAL: "Especiais",
};

interface AnimesPageProps {
  searchParams: Promise<{ q?: string; tipo?: string }>;
}

export default async function AnimesPage({ searchParams }: AnimesPageProps) {
  const sp = await searchParams;
  const q = sp.q ?? "";
  const tipo = sp.tipo ?? "TV";

  let items: Awaited<ReturnType<typeof listAnimeByType>> = [];
  let error: string | null = null;
  try {
    const [cats, titles] = await Promise.all([
      animeCategories(),
      listAnimeByType(tipo, q, 60),
    ]);
    items = titles;
  } catch (err) {
    error = err instanceof Error ? err.message : "erro ao carregar animes";
  }

  const categorias = await animeCategories().catch(() => []);

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6">
      <header className="mb-8">
        <h1 className="text-2xl font-black tracking-tight text-ink sm:text-3xl">Animes</h1>
        <p className="mt-1 text-sm text-muted">
          {error
            ? "Catálogo de animes indisponível."
            : `${items.length} ${items.length === 1 ? "título" : "títulos"} — ${TYPE_LABELS[tipo] ?? tipo}`}
        </p>
        <SearchBar defaultValue={sp.q ?? ""} className="mt-4 max-w-md" action="/animes" />
      </header>

      {/* Categorias */}
      <div className="mb-6 flex flex-wrap gap-2">
        {categorias.map((cat) => {
          const isActive = cat.type === tipo;
          return (
            <Link
              key={cat.type}
              href={`/animes?tipo=${cat.type}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                isActive
                  ? "bg-accent text-white"
                  : "bg-surface-strong text-muted hover:text-ink"
              }`}
            >
              {TYPE_LABELS[cat.type] ?? cat.type} · {cat.count}
            </Link>
          );
        })}
      </div>

      {error ? (
        <div className="rounded-2xl border border-line bg-surface py-16 text-center">
          <p className="text-sm text-muted">{error}</p>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface py-16 text-center">
          <p className="text-sm text-muted">
            {q ? `Nenhum anime encontrado para "${q}".` : "Nenhum anime nesta categoria."}
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
              subtitle={[anime.year, anime.episodes ? `${anime.episodes} eps` : null]
                .filter(Boolean)
                .join(" · ")}
            />
          ))}
        </div>
      )}
    </div>
  );
}
