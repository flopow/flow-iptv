import type { Metadata } from "next";
import Link from "next/link";

import { PosterCard } from "@/components/ui/PosterCard";
import { SearchBar } from "@/components/ui/SearchBar";
import { getCatalog } from "@/lib/catalog";
import type { Film } from "@/types";

export const metadata: Metadata = { title: "Filmes" };

interface FilmesPageProps {
  searchParams: Promise<{ q?: string; genero?: string; ordem?: string }>;
}

export default async function FilmesPage({ searchParams }: FilmesPageProps) {
  const sp = await searchParams;
  const catalog = await getCatalog();
  const films = await catalog.listFilms();

  const genres = [...new Set(films.flatMap((f) => f.genres))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const q = (sp.q ?? "").trim().toLowerCase();
  const genero = sp.genero ?? "";

  let filtered = films;
  if (q) filtered = filtered.filter((f) => f.title.toLowerCase().includes(q));
  if (genero) filtered = filtered.filter((f) => f.genres.includes(genero));

  switch (sp.ordem) {
    case "ano":
      filtered = filtered
        .slice()
        .sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
      break;
    case "titulo":
      filtered = filtered.slice().sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));
      break;
    default:
      filtered = filtered
        .slice()
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6">
      <header className="mb-8">
        <h1 className="text-2xl font-black tracking-tight text-ink sm:text-3xl">Filmes</h1>
        <p className="mt-1 text-sm text-muted">
          {filtered.length} {filtered.length === 1 ? "título" : "títulos"}
          {genero ? ` em ${genero}` : ""}
        </p>
        <SearchBar defaultValue={sp.q ?? ""} className="mt-4 max-w-md" />
      </header>

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
          <p className="text-sm font-semibold text-muted">
            Nenhum filme encontrado com esses filtros.
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
              badge={film.ageRating ?? undefined}
              subtitle={[film.year, film.durationMinutes ? `${film.durationMinutes} min` : null]
                .filter(Boolean)
                .join(" · ")}
            />
          ))}
        </div>
      )}
    </div>
  );
}
