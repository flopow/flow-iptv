import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PosterCard } from "@/components/ui/PosterCard";
import { PlayIcon } from "@/components/ui/icons";
import { TrailerButton } from "@/components/ui/TrailerButton";
import { getCatalog } from "@/lib/catalog";
import { seriesPlayHref } from "@/lib/nav";
import { getStreamTitleById, getStreamTrailer, streamWatchUrl } from "@/lib/stream";
import type { Episode } from "@/types";

interface SeriesDetailProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: SeriesDetailProps): Promise<Metadata> {
  const { id } = await params;
  const catalog = await getCatalog();
  const serie = await catalog.getSeries(id);
  if (!serie && id.startsWith("stream-")) {
    const title = await getStreamTitleById(id).catch(() => null);
    return {
      title: title?.title ?? "Série não encontrada",
      description: title?.synopsis,
    };
  }
  return {
    title: serie && serie.status === "published" ? serie.title : "Série não encontrada",
    description: serie?.synopsis,
  };
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold text-foreground">{value}</dd>
    </div>
  );
}

function EpisodeRow({ serieId, episode }: { serieId: string; episode: Episode }) {  return (
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

  // Título externo (TMDB): exibe metadados + link oficial de onde assistir.
  if (!serie && id.startsWith("stream-")) {
    const title = await getStreamTitleById(id).catch(() => null);
    if (!title) notFound();
    const watchUrl = streamWatchUrl(title);
    const trailer = await getStreamTrailer(title.tmdbId, title.kind).catch(() => null);
    return (
      <article className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6">
        <div className="relative -mx-4 mb-8 h-48 overflow-hidden rounded-none bg-gradient-to-br from-accent-soft via-surface-strong to-surface sm:-mx-6 sm:h-64 sm:rounded-2xl">
          {title.posterUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={title.posterUrl.replace("/w500", "/w1280")}
              alt=""
              className="h-full w-full object-cover opacity-40"
              loading="lazy"
            />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-6 sm:p-10">
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-accent">
              {title.kind === "film" ? "Filme" : "Série"} · TMDB
            </p>
            <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
              {title.title}
            </h1>
          </div>
        </div>

        <div className="flex flex-col gap-8 md:flex-row md:gap-10">
          <div className="w-40 flex-none sm:w-56">
            {title.posterUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={title.posterUrl}
                alt={title.title}
                className="w-full rounded-2xl border border-line shadow-lg"
                loading="lazy"
              />
            ) : (
              <div className="flex h-72 w-full items-center justify-center rounded-2xl border border-line bg-surface text-5xl font-black text-accent/60">
                {(title.title.trim().charAt(0) || "F").toUpperCase()}
              </div>
            )}
          </div>

          <div className="flex-1">
            <h1 className="text-3xl font-black tracking-tight text-ink sm:text-4xl">
              {title.title}
            </h1>
            {title.synopsis ? (
              <p className="mt-3 leading-relaxed text-foreground/90">{title.synopsis}</p>
            ) : null}

            <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
              {title.year ? <MetaItem label="Ano" value={String(title.year)} /> : null}
              {title.genres.length > 0 ? (
                <MetaItem label="Gêneros" value={title.genres.join(", ")} />
              ) : null}
            </dl>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href={watchUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-accent px-7 py-3.5 text-sm font-bold text-white shadow transition-transform hover:scale-[1.02] hover:bg-accent-strong active:scale-[0.98]"
              >
                <PlayIcon className="h-5 w-5" /> Assistir agora
              </a>
            </div>
            <p className="mt-3 max-w-md text-xs text-muted">
              Título exibido via TMDB (metadados públicos). A reprodução acontece na plataforma
              oficial onde ele está disponível.
            </p>
            {trailer ? (
              <TrailerButton youtubeId={trailer.youtubeId} label={trailer.name} />
            ) : null}
          </div>
        </div>
      </article>
    );
  }

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
