import type { Metadata } from "next";

import { PlatformSidebar } from "@/components/ui/PlatformSidebar";
import { PosterCard } from "@/components/ui/PosterCard";
import { SearchBar } from "@/components/ui/SearchBar";
import { getCatalog } from "@/lib/catalog";
import { getPlatformCatalog, getPopularCatalog, hasStreamKey, STREAM_PLATFORMS } from "@/lib/stream";
import { hasOmdbKey, omdbSearch } from "@/lib/omdb";
import { isSourceActive } from "@/lib/sources";

export const metadata: Metadata = { title: "Filmes" };

interface FilmesPageProps {
  searchParams: Promise<{ q?: string; plataforma?: string }>;
}

export default async function FilmesPage({ searchParams }: FilmesPageProps) {
  const sp = await searchParams;
  const plataforma = sp.plataforma ?? "";
  const platform = STREAM_PLATFORMS.find((p) => p.id === plataforma);
  const q = (sp.q ?? "").trim().toLowerCase();

  const catalog = await getCatalog();
  const films = await catalog.listFilms(); // catálogo local publicado (vazio hoje)

  // Fonte exibida:
  // - plataforma selecionada → TMDB filtrado por provider;
  // - "Todos" → TMDB popular (se catálogo local estiver vazio).
  let items: Awaited<ReturnType<typeof getPopularCatalog>> = [];
  let streamError: string | null = null;
  const useLocal = films.length > 0;
  const [tmdbOn, omdbOn] = await Promise.all([isSourceActive("tmdb"), isSourceActive("omdb")]);
  if (useLocal && !platform) {
    items = films.map((f) => ({
      id: `local-${f.id}`,
      title: f.title,
      synopsis: f.synopsis,
      posterUrl: f.posterUrl,
      year: f.year,
      genres: f.genres,
      kind: "film" as const,
      tmdbId: 0,
    }));
  } else if (tmdbOn && hasStreamKey()) {
    try {
      items = platform
        ? (await getPlatformCatalog(platform, 40)).filter((t) => t.kind === "film")
        : (await getPopularCatalog(40)).filter((t) => t.kind === "film");
    } catch (err) {
      streamError = err instanceof Error ? err.message : "erro ao buscar";
    }
  } else if (!useLocal && (!tmdbOn || !hasStreamKey())) {
    streamError = tmdbOn ? "TMDB_API_KEY não configurada" : "Fonte TMDB desativada";
  }

  const filtered = q ? items.filter((t) => t.title.toLowerCase().includes(q)) : items;

  // Busca extra via OMDb quando há termo (mais resultados além do TMDB).
  let omdbItems: Awaited<ReturnType<typeof omdbSearch>> = [];
  if (q && omdbOn && hasOmdbKey()) {
    try {
      omdbItems = (await omdbSearch(q, 12)).filter((t) => t.kind === "film");
    } catch {
      omdbItems = [];
    }
  }
  const allItems = [...filtered, ...omdbItems.filter((o) => !filtered.some((f) => f.id === o.id))];

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6">
      <header className="mb-8">
        <h1 className="text-2xl font-black tracking-tight text-ink sm:text-3xl">Filmes</h1>
        <p className="mt-1 text-sm text-muted">
          {platform
            ? `Disponíveis na ${platform.label}`
            : `${allItems.length} ${allItems.length === 1 ? "título" : "títulos"}`}
        </p>
        <SearchBar
          defaultValue={sp.q ?? ""}
          className="mt-4 max-w-md"
          action={platform ? `/filmes?plataforma=${platform.id}` : "/filmes"}
        />
      </header>

      <div className="flex flex-col gap-8 md:flex-row">
        <PlatformSidebar baseHref="/filmes" active={platform ? platform.id : null} />

        <div className="min-w-0 flex-1">
          {streamError ? (
            <div className="rounded-2xl border border-line bg-surface py-16 text-center">
              <p className="text-sm text-muted">{streamError}</p>
            </div>
          ) : allItems.length === 0 ? (
            <div className="rounded-2xl border border-line bg-surface py-16 text-center">
              <p className="text-sm text-muted">
                {q ? `Nenhum filme encontrado para "${sp.q}".` : "Nenhum filme encontrado."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {allItems.map((item) => (
                <PosterCard
                  key={item.id}
                  href={item.tmdbId ? `/filmes/${item.id}` : "#"}
                  title={item.title}
                  posterUrl={item.posterUrl}
                  badge={item.kind === "film" ? "Filme" : "Série"}
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
