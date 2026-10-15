import type { Metadata } from "next";
import Link from "next/link";

import { PlatformSidebar } from "@/components/ui/PlatformSidebar";
import { PosterCard } from "@/components/ui/PosterCard";
import { SearchBar } from "@/components/ui/SearchBar";
import { getCatalog } from "@/lib/catalog";
import { getPlatformCatalog, hasStreamKey, STREAM_PLATFORMS } from "@/lib/stream";
import type { Film } from "@/types";

export const metadata: Metadata = { title: "Filmes" };

interface FilmesPageProps {
  searchParams: Promise<{ q?: string; genero?: string; ordem?: string; plataforma?: string }>;
}

export default async function FilmesPage({ searchParams }: FilmesPageProps) {
  const sp = await searchParams;
  const plataforma = sp.plataforma ?? "";
  const platform = STREAM_PLATFORMS.find((p) => p.id === plataforma);

  const catalog = await getCatalog();
  const films = await catalog.listFilms();
  const genres = [...new Set(films.flatMap((f) => f.genres))].sort((a, b) =>
    a.localeCompare(b, "pt-BR"),
  );

  // modo plataforma (TMDB): mostra títulos disponíveis no serviço
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

  const q = (sp.q ?? "").trim().toLowerCase();
  const genero = sp.genero ?? "";

  let filtered = films;
  if (q) filtered = filtered.filter((f) => f.title.toLowerCase().includes(q));
  if (genero) filtered = filtered.filter((f) => f.genres.includes(genero));
  switch (sp.ordem) {
    case "ano":
      filtered = filtered.slice().sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
      break;
    case "titulo":
      filtered = filtered.slice().sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));
      break;
    default:
      filtered = filtered.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  const streamFilms = streamTitles?.filter((t) => t.kind === "film") ?? [];

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6">
      <header className="mb-8">
        <h1 className="text-2xl font-black tracking-tight text-ink sm:text-3xl">Filmes</h1>
        <p className="mt-1 text-sm text-muted">
          {platform
            ? `Disponíveis na ${platform.label}`
            : `${filtered.length} ${filtered.length === 1 ? "título" : "títulos"}${genero ? ` em ${genero}` : ""}`}
        </p>
        {!platform ? <SearchBar defaultValue={sp.q ?? ""} className="mt-4 max-w-md" /> : null}
      </header>

      <div className="flex flex-col gap-8 md:flex-row">
        <PlatformSidebar baseHref="/filmes" active={platform ? platform.id : null} />

        <div className="min-w-0 flex-1">
          {platform ? (
            streamError ? (
              <div className="rounded-2xl border border-line bg-surface py-16 text-center">
                <p className="text-sm text-muted">{streamError}</p>
              </div>
            ) : streamFilms.length === 0 ? (
              <div className="rounded-2xl border border-line bg-surface py-16 text-center">
                <p className="text-sm text-muted">Nenhum filme retornado para esta plataforma.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {streamFilms.map((item) => (
                  <PosterCard
                    key={item.id}
                    href="#"
                    title={item.title}
                    posterUrl={item.posterUrl}
                    badge="Filme"
                    subtitle={[item.year, item.genres[0]].filter(Boolean).join(" · ")}
                  />
                ))}
              </div>
            )
          ) : (
            <>
              <div className="mb-8 flex flex-wrap items-center gap-2">
                <Link
                  href="/filmes"
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                    !genero ? "bg-accent text-white" : "bg-surface-strong text-muted hover:text-ink"
                  }`}
                >
                  Todos
                </Link>
                {genres.map((genre) => (
                  <Link
                    key={genre}
                    href={`/filmes?genero=${encodeURIComponent(genre)}`}
                    className={`rounded-full px-4 py-2 text-sm font-semibold capitalize transition-colors ${
                      genero === genre ? "bg-accent text-white" : "bg-surface-strong text-muted hover:text-ink"
                    }`}
                  >
                    {genre}
                  </Link>
                ))}
                <form action="/filmes" method="get" className="ml-auto flex items-center gap-2">
                  {genero ? <input type="hidden" name="genero" value={genero} /> : null}
                  {q ? <input type="hidden" name="q" value={sp.q ?? ""} /> : null}
                  <select
                    name="ordem"
                    defaultValue={sp.ordem ?? "novidades"}
                    className="rounded-full border border-line bg-surface px-4 py-2 text-sm font-semibold text-foreground focus:border-accent focus:outline-none"
                  >
                    <option value="novidades">Novidades</option>
                    <option value="ano">Ano</option>
                    <option value="titulo">Título</option>
                  </select>
                  <button
                    type="submit"
                    className="rounded-full bg-accent px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-accent-strong"
                  >
                    Ordenar
                  </button>
                </form>
              </div>

              {filtered.length === 0 ? (
                <div className="rounded-2xl border border-line bg-surface py-20 text-center">
                  <p className="text-sm text-muted">
                    Nenhum filme encontrado{q ? ` para "${q}"` : ""}.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {filtered.map((film: Film) => (
                    <PosterCard
                      key={film.id}
                      href={`/filmes/${film.id}`}
                      title={film.title}
                      posterUrl={film.posterUrl}
                      badge={film.year ? String(film.year) : undefined}
                      subtitle={film.genres[0]}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
