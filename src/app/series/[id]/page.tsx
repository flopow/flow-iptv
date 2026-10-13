import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PosterCard } from "@/components/ui/PosterCard";
import { PlayIcon } from "@/components/ui/icons";
import { getCatalog } from "@/lib/catalog";
import { seriesPlayHref } from "@/lib/nav";
import type { Episode } from "@/types";

interface SeriesDetailProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: SeriesDetailProps): Promise<Metadata> {
  const { id } = await params;
  const catalog = await getCatalog();
  const serie = await catalog.getSeries(id);
  return {
    title: serie && serie.status === "published" ? serie.title : "Série não encontrada",
    description: serie?.synopsis,
  };
}

function EpisodeRow({ serieId, episode }: { serieId: string; episode: Episode }) {
  return (
    <li className="flex items-center gap-4 rounded-xl border border-line bg-surface px-4 py-3 transition-colors hover:border-accent-line">
      <span className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-accent-soft text-sm font-black text-accent">
        {episode.number}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-foreground">{episode.title}</p>
        {episode.synopsis ? (
          <p className="mt-0.5 line-clamp-1 text-xs text-muted">{episode.synopsis}</p>
        ) : null}
      </div>
      <span className="flex-none text-xs font-semibold text-muted">
        {episode.durationMinutes ? `${episode.durationMinutes} min` : ""}
      </span>
      {episode.mediaFileId ? (
        <Link
          href={`/player/serie/${serieId}?ep=${episode.id}`}
          className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-accent text-white transition-colors hover:bg-accent-strong"
          aria-label={`Assistir ${episode.title}`}
        >
          <PlayIcon className="h-4 w-4" />
        </Link>
      ) : (
        <span
          className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-surface-strong text-xs font-bold text-muted"
          title="Mídia ainda não publicada"
        >
          — 
        </span>
      )}
    </li>
  );
}

export default async function SeriesDetailPage({ params }: SeriesDetailProps) {
  const { id } = await params;
  const catalog = await getCatalog();
  const serie = await catalog.getSeries(id);
  if (!serie || serie.status !== "published") notFound();

  const playHref = seriesPlayHref(serie);
  const episodeCount = serie.seasons.reduce((acc, s) => acc + s.episodes.length, 0);

  return (
    <article className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6">
      <div className="flex flex-col gap-8 md:flex-row md:gap-10">
        <div className="w-40 flex-none sm:w-56">
          <PosterCard href={`/series/${serie.id}`} title={serie.title} posterUrl={serie.posterUrl} badge={serie.ageRating ?? undefined} />
        </div>

        <div className="flex-1">
          <h1 className="text-3xl font-black tracking-tight text-ink sm:text-4xl">{serie.title}</h1>
          <p className="mt-3 leading-relaxed text-foreground/90">{serie.synopsis}</p>

          <div className="mt-5 flex flex-wrap gap-2">
            {serie.genres.map((genre) => (
              <span
                key={genre}
                className="rounded-full bg-accent-soft px-3 py-1 text-xs font-bold capitalize text-accent-strong"
              >
                {genre}
              </span>
            ))}
          </div>

          <p className="mt-5 text-sm text-muted">
            {serie.seasons.length} temporada{serie.seasons.length === 1 ? "" : "s"} ·{" "}
            {episodeCount} episódios
            {serie.year ? ` · ${serie.year}` : ""} · classificação {serie.ageRating ?? "L"}
          </p>

          <div className="mt-6">
            {playHref ? (
              <Link
                href={playHref}
                className="inline-flex items-center gap-2 rounded-full bg-accent px-7 py-3.5 text-sm font-bold text-white shadow transition-transform hover:scale-[1.02] hover:bg-accent-strong active:scale-[0.98]"
              >
                <PlayIcon className="h-5 w-5" /> Assistir agora
              </Link>
            ) : (
              <span className="inline-flex items-center rounded-full bg-surface-strong px-7 py-3.5 text-sm font-bold text-muted">
                Em breve
              </span>
            )}
          </div>
        </div>
      </div>

      <section className="mt-12 space-y-4" aria-label="Temporadas e episódios">
        {serie.seasons.map((season) => (
          <details key={season.id} open className="group rounded-2xl border border-line bg-background">
            <summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-sm font-black text-ink [&::-webkit-details-marker]:hidden">
              {season.title}
              <span className="text-xs font-semibold text-muted">
                {season.episodes.length} episódios
              </span>
            </summary>
            <ul className="space-y-2 px-3 pb-4">
              {season.episodes.map((episode) => (
                <EpisodeRow key={episode.id} serieId={serie.id} episode={episode} />
              ))}
            </ul>
          </details>
        ))}
      </section>
    </article>
  );
}
