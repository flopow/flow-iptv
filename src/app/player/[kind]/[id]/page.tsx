import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Player } from "@/components/Player";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/icons";
import { getCatalog, toPlayableUrl } from "@/lib/catalog";
import { getAnimeById } from "@/lib/anime";
import { episodeNeighbors, shortNeighbors } from "@/lib/nav";

interface PlayerPageProps {
  params: Promise<{ kind: "filme" | "serie" | "drama" | "anime"; id: string }>;
  searchParams: Promise<{ ep?: string }>;
}

type PlayerConfig = {
  title: string;
  subtitle: string;
  src: string | null;
  vertical: boolean;
  nextHref: string | null;
  nextLabel: string | null;
  subtitleUrl: string | null;
  backHref: string;
};

export const metadata: Metadata = { title: "Player" };

async function resolveConfig(
  kind: "filme" | "serie" | "drama" | "anime",
  id: string,
  ep?: string,
): Promise<PlayerConfig | null> {
  const catalog = await getCatalog();

  if (kind === "filme") {
    const film = await catalog.getFilm(id);
    if (!film || film.status !== "published") return null;
    const media = film.mediaFileId ? await catalog.getMediaFile(film.mediaFileId) : null;
    return {
      title: film.title,
      subtitle: [film.year, film.durationMinutes ? `${film.durationMinutes} min` : null]
        .filter(Boolean)
        .join(" · "),
      src: media ? toPlayableUrl(media) : null,
      vertical: false,
      nextHref: null,
      nextLabel: null,
      subtitleUrl: null,
      backHref: `/filmes/${film.id}`,
    };
  }

  if (kind === "serie") {
    const serie = await catalog.getSeries(id);
    if (!serie || serie.status !== "published") return null;
    const episodes = serie.seasons.flatMap((s) => s.episodes);
    const current = episodes.find((e) => e.id === ep) ?? episodes.find((e) => e.mediaFileId);
    if (!current) return null;
    const media = current.mediaFileId ? await catalog.getMediaFile(current.mediaFileId) : null;
    const neighbors = episodeNeighbors(serie, current.id);
    return {
      title: `${serie.title} · E${current.number} — ${current.title}`,
      subtitle: `Temporada ${serie.seasons.find((s) => s.episodes.some((e) => e.id === current.id))?.number ?? 1}`,
      src: media ? toPlayableUrl(media) : null,
      vertical: false,
      nextHref: neighbors.next ? `/player/serie/${serie.id}?ep=${neighbors.next.id}` : null,
      nextLabel: neighbors.next?.label ?? null,
      subtitleUrl: current.subtitleUrl ?? null,
      backHref: `/series/${serie.id}`,
    };
  }

  // anime — episódios importados, vídeo via catálogo (GitHub/Drive)
  if (kind === "anime") {
    const anime = await getAnimeById(id);
    if (!anime) return null;
    const current =
      anime.episodes.find((e) => e.id === ep && e.mediaFileId) ??
      anime.episodes.find((e) => e.mediaFileId);
    if (!current?.mediaFileId) return null;
    const media = await catalog.getMediaFile(current.mediaFileId);
    const index = anime.episodes.indexOf(current);
    const next =
      index >= 0
        ? anime.episodes.slice(index + 1).find((e) => e.mediaFileId)
        : null;
    const nextMedia = next?.mediaFileId ? await catalog.getMediaFile(next.mediaFileId) : null;
    return {
      title: `${anime.title} · E${current.number} — ${current.title}`,
      subtitle: "Anime",
      src: media ? toPlayableUrl(media) : null,
      vertical: false,
      nextHref:
        next && nextMedia
          ? `/player/anime/${encodeURIComponent(anime.id)}?ep=${encodeURIComponent(next.id)}`
          : null,
      nextLabel: next ? `E${next.number} · ${next.title}` : null,
      subtitleUrl: null,
      backHref: `/animes/${encodeURIComponent(anime.id)}`,
    };
  }

  // drama — player vertical estilo ReelShort
  const short = await catalog.getShort(id);
  if (!short || short.status !== "published") return null;
  const current = short.episodes.find((e) => e.id === ep) ?? short.episodes.find((e) => e.mediaFileId);
  if (!current) return null;
  const media = current.mediaFileId ? await catalog.getMediaFile(current.mediaFileId) : null;
  const neighbors = shortNeighbors(short, current.id);
  return {
    title: current.title,
    subtitle: `${short.title} · Ep. ${current.number}`,
    src: media ? toPlayableUrl(media) : null,
    vertical: true,
    nextHref: neighbors.next ? `/player/drama/${short.id}?ep=${neighbors.next.id}` : null,
    nextLabel: neighbors.next?.label ?? null,
    subtitleUrl: current.subtitleUrl ?? null,
    backHref: `/dramas/${short.id}`,
  };
}

export default async function PlayerPage({ params, searchParams }: PlayerPageProps) {
  const { kind, id } = await params;
  const { ep } = await searchParams;
  const config = await resolveConfig(kind, id, ep);
  if (!config) notFound();

  const dramaEpisodes = kind === "drama" ? await buildEpisodeList(id, ep) : null;

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6">
      <nav className="mb-4 flex items-center gap-2 text-sm">
        <Link
          href={config.backHref}
          className="inline-flex items-center gap-1 font-semibold text-muted transition-colors hover:text-accent"
        >
          <ChevronLeftIcon className="h-4 w-4" /> Voltar
        </Link>
        {config.nextHref ? (
          <Link
            href={config.nextHref}
            className="ml-auto inline-flex items-center gap-1 font-semibold text-accent transition-colors hover:text-accent-strong"
          >
            Próximo <ChevronRightIcon className="h-4 w-4" />
          </Link>
        ) : null}
      </nav>

      <Player
        src={config.src}
        title={config.title}
        vertical={config.vertical}
        nextHref={config.nextHref}
        nextLabel={config.nextLabel}
        subtitleUrl={config.subtitleUrl}
      />

      <div className="mt-4 text-center sm:text-left">
        <h1 className="text-lg font-bold text-ink">{config.title}</h1>
        <p className="text-sm text-muted">{config.subtitle}</p>
      </div>

      {dramaEpisodes ? (
        <section className="mt-6" aria-label="Lista de episódios">
          <h2 className="mb-3 text-sm font-black uppercase tracking-wide text-muted">Episódios</h2>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{dramaEpisodes}</ul>
        </section>
      ) : null}
    </div>
  );
}

async function buildEpisodeList(id: string, ep?: string) {
  const catalog = await getCatalog();
  const short = await catalog.getShort(id);
  if (!short) return null;
  return short.episodes.map((episode) => (
    <li key={episode.id}>
      <Link
        href={`/player/drama/${short.id}?ep=${episode.id}`}
        className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-colors ${
          episode.id === ep
            ? "border-accent bg-accent-soft font-bold text-accent-strong"
            : "border-line bg-surface text-foreground hover:border-accent-line"
        }`}
      >
        <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-accent-soft text-xs font-black text-accent">
          {episode.number}
        </span>
        <span className="truncate">{episode.title}</span>
      </Link>
    </li>
  ));
}
