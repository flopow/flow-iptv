import type { Metadata } from "next";

import { PosterCard } from "@/components/ui/PosterCard";
import { SearchBar } from "@/components/ui/SearchBar";
import { getCatalog } from "@/lib/catalog";

export const metadata: Metadata = { title: "Busca" };

interface BuscaPageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function BuscaPage({ searchParams }: BuscaPageProps) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const catalog = await getCatalog();
  const results = q ? await catalog.search(q) : null;
  const total = results
    ? results.films.length + results.series.length + results.shorts.length
    : 0;

  if (!q) {
    return (
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6">
        <HeaderSearch q={q} />
        <div className="rounded-2xl border border-line bg-surface py-20 text-center">
          <p className="text-sm font-semibold text-muted">
            Digite um título ou gênero para começar.
          </p>
        </div>
      </div>
    );
  }

  if (!results || total === 0) {
    return (
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6">
        <HeaderSearch q={q} />
        <div className="rounded-2xl border border-line bg-surface py-20 text-center">
          <p className="text-sm font-semibold text-muted">
            Nada encontrado para “{q}”. Tente outro termo.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6">
      <HeaderSearch q={q} />
      <div className="space-y-10">
        <p className="text-sm font-semibold text-muted">
          {total} {total === 1 ? "resultado" : "resultados"} para “{q}”
        </p>

        {results.films.length > 0 ? (
          <section>
            <h2 className="mb-4 text-lg font-bold text-ink">Filmes</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {results.films.map((film) => (
                <PosterCard
                  key={film.id}
                  href={`/filmes/${film.id}`}
                  title={film.title}
                  posterUrl={film.posterUrl}
                  badge={film.ageRating ?? undefined}
                />
              ))}
            </div>
          </section>
        ) : null}

        {results.series.length > 0 ? (
          <section>
            <h2 className="mb-4 text-lg font-bold text-ink">Séries</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {results.series.map((serie) => (
                <PosterCard
                  key={serie.id}
                  href={`/series/${serie.id}`}
                  title={serie.title}
                  posterUrl={serie.posterUrl}
                  badge={serie.ageRating ?? undefined}
                />
              ))}
            </div>
          </section>
        ) : null}

        {results.shorts.length > 0 ? (
          <section>
            <h2 className="mb-4 text-lg font-bold text-ink">Dramas Curtos</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {results.shorts.map((short) => (
                <PosterCard
                  key={short.id}
                  href={`/dramas/${short.id}`}
                  title={short.title}
                  posterUrl={short.posterUrl}
                  badge={short.ageRating ?? undefined}
                  aspect="vertical"
                />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function HeaderSearch({ q }: { q: string }) {
  return (
    <header className="mb-8">
      <h1 className="text-2xl font-black tracking-tight text-ink sm:text-3xl">Busca</h1>
      <SearchBar defaultValue={q} autoFocus className="mt-4 max-w-md" />
    </header>
  );
}
