import type { Metadata } from "next";

import { PosterCard } from "@/components/ui/PosterCard";
import { SearchBar } from "@/components/ui/SearchBar";
import { getCatalog } from "@/lib/catalog";

export const metadata: Metadata = { title: "Séries" };

interface SeriesPageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function SeriesPage({ searchParams }: SeriesPageProps) {
  const sp = await searchParams;
  const catalog = await getCatalog();
  const series = await catalog.listSeries();
  const q = (sp.q ?? "").trim().toLowerCase();
  const filtered = q ? series.filter((s) => s.title.toLowerCase().includes(q)) : series;

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6">
      <header className="mb-8">
        <h1 className="text-2xl font-black tracking-tight text-ink sm:text-3xl">Séries</h1>
        <p className="mt-1 text-sm text-muted">
          {filtered.length} {filtered.length === 1 ? "série" : "séries"}
        </p>
        <SearchBar defaultValue={sp.q ?? ""} className="mt-4 max-w-md" />
      </header>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface py-20 text-center">
          <p className="text-sm font-semibold text-muted">Nenhuma série encontrada.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filtered.map((serie) => {
            const seasons = serie.seasons.length;
            return (
              <PosterCard
                key={serie.id}
                href={`/series/${serie.id}`}
                title={serie.title}
                posterUrl={serie.posterUrl}
                badge={serie.ageRating ?? undefined}
                subtitle={[serie.year, seasons ? `${seasons} temporada${seasons === 1 ? "" : "s"}` : null]
                  .filter(Boolean)
                  .join(" · ")}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
