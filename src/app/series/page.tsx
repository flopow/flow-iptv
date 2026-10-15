import type { Metadata } from "next";

import { PlatformSidebar } from "@/components/ui/PlatformSidebar";
import { PosterCard } from "@/components/ui/PosterCard";
import { SearchBar } from "@/components/ui/SearchBar";
import { getCatalog } from "@/lib/catalog";
import { getPlatformCatalog, getPopularCatalog, hasStreamKey, STREAM_PLATFORMS } from "@/lib/stream";
import { isSourceActive } from "@/lib/sources";

export const metadata: Metadata = { title: "Séries" };

interface SeriesPageProps {
  searchParams: Promise<{ q?: string; plataforma?: string }>;
}

export default async function SeriesPage({ searchParams }: SeriesPageProps) {
  const sp = await searchParams;
  const plataforma = sp.plataforma ?? "";
  const platform = STREAM_PLATFORMS.find((p) => p.id === plataforma);
  const q = (sp.q ?? "").trim().toLowerCase();

  const catalog = await getCatalog();
  const series = await catalog.listSeries(); // catálogo local publicado (vazio hoje)

  let items: Awaited<ReturnType<typeof getPopularCatalog>> = [];
  let streamError: string | null = null;
  const useLocal = series.length > 0;
  const [tmdbOn] = await Promise.all([isSourceActive("tmdb")]);
  if (useLocal && !platform) {
    items = series.map((s) => ({
      id: `local-${s.id}`,
      title: s.title,
      synopsis: s.synopsis,
      posterUrl: s.posterUrl,
      year: s.year,
      genres: s.genres,
      kind: "series" as const,
      tmdbId: 0,
    }));
  } else if (tmdbOn && hasStreamKey()) {
    try {
      items = platform
        ? (await getPlatformCatalog(platform, 40)).filter((t) => t.kind === "series")
        : (await getPopularCatalog(40)).filter((t) => t.kind === "series");
    } catch (err) {
      streamError = err instanceof Error ? err.message : "erro ao buscar";
    }
  } else if (!useLocal && (!tmdbOn || !hasStreamKey())) {
    streamError = tmdbOn ? "TMDB_API_KEY não configurada" : "Fonte TMDB desativada";
  }

  const allItems = q ? items.filter((t) => t.title.toLowerCase().includes(q)) : items;

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6">
      <header className="mb-8">
        <h1 className="text-2xl font-black tracking-tight text-ink sm:text-3xl">Séries</h1>
        <p className="mt-1 text-sm text-muted">
          {platform
            ? `Disponíveis na ${platform.label}`
            : `${allItems.length} ${allItems.length === 1 ? "série" : "séries"}`}
        </p>
        <SearchBar
          defaultValue={sp.q ?? ""}
          className="mt-4 max-w-md"
          action={platform ? `/series?plataforma=${platform.id}` : "/series"}
        />
      </header>

      <div className="flex flex-col gap-8 md:flex-row">
        <PlatformSidebar baseHref="/series" active={platform ? platform.id : null} />

        <div className="min-w-0 flex-1">
          {streamError ? (
            <div className="rounded-2xl border border-line bg-surface py-16 text-center">
              <p className="text-sm text-muted">{streamError}</p>
            </div>
          ) : allItems.length === 0 ? (
            <div className="rounded-2xl border border-line bg-surface py-16 text-center">
              <p className="text-sm text-muted">
                {q ? `Nenhuma série encontrada para "${sp.q}".` : "Nenhuma série encontrada."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {allItems.map((item) => (
                <PosterCard
                  key={item.id}
                  href={item.tmdbId ? `/series/${item.id}` : "#"}
                  title={item.title}
                  posterUrl={item.posterUrl}
                  badge="Série"
                  subtitle={[item.year, item.genres[0]].filter(Boolean).join(" · ")}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
