import type { Metadata } from "next";

import { PlatformSidebar } from "@/components/ui/PlatformSidebar";
import { PosterCard } from "@/components/ui/PosterCard";
import { SearchBar } from "@/components/ui/SearchBar";
import { getCatalog } from "@/lib/catalog";
import { getPlatformCatalog, hasStreamKey, STREAM_PLATFORMS } from "@/lib/stream";

export const metadata: Metadata = { title: "Séries" };

interface SeriesPageProps {
  searchParams: Promise<{ q?: string; plataforma?: string }>;
}

export default async function SeriesPage({ searchParams }: SeriesPageProps) {
  const sp = await searchParams;
  const plataforma = sp.plataforma ?? "";
  const platform = STREAM_PLATFORMS.find((p) => p.id === plataforma);

  const catalog = await getCatalog();
  const series = await catalog.listSeries();
  const q = (sp.q ?? "").trim().toLowerCase();
  const filtered = q ? series.filter((s) => s.title.toLowerCase().includes(q)) : series;

  let streamTitles: Awaited<ReturnType<typeof getPlatformCatalog>> | null = null;
  let streamError: string | null = null;
  if (platform) {
    if (!hasStreamKey()) streamError = "TMDB_API_KEY não configurada";
    else {
      try {
        streamTitles = await getPlatformCatalog(platform, 40);
      } catch (err) {
        streamError = err instanceof Error ? err.message : "erro ao buscar";
      }
    }
  }
  const streamSeries = streamTitles?.filter((t) => t.kind === "series") ?? [];

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6">
      <header className="mb-8">
        <h1 className="text-2xl font-black tracking-tight text-ink sm:text-3xl">Séries</h1>
        <p className="mt-1 text-sm text-muted">
          {platform
            ? `Disponíveis na ${platform.label}`
            : `${filtered.length} ${filtered.length === 1 ? "série" : "séries"}`}
        </p>
        {!platform ? <SearchBar defaultValue={sp.q ?? ""} className="mt-4 max-w-md" /> : null}
      </header>

      <div className="flex flex-col gap-8 md:flex-row">
        <PlatformSidebar baseHref="/series" active={platform ? platform.id : null} />

        <div className="min-w-0 flex-1">
          {platform ? (
            streamError ? (
              <div className="rounded-2xl border border-line bg-surface py-16 text-center">
                <p className="text-sm text-muted">{streamError}</p>
              </div>
            ) : streamSeries.length === 0 ? (
              <div className="rounded-2xl border border-line bg-surface py-16 text-center">
                <p className="text-sm text-muted">Nenhuma série retornada para esta plataforma.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {streamSeries.map((item) => (
                  <PosterCard
                    key={item.id}
                    href="#"
                    title={item.title}
                    posterUrl={item.posterUrl}
                    badge="Série"
                    subtitle={[item.year, item.genres[0]].filter(Boolean).join(" · ")}
                  />
                ))}
              </div>
            )
          ) : filtered.length === 0 ? (
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
      </div>
    </div>
  );
}
