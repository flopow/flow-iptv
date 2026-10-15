import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PosterCard } from "@/components/ui/PosterCard";
import { PlayIcon } from "@/components/ui/icons";
import { getCatalog, toPlayableUrl } from "@/lib/catalog";
import { filmPlayHref } from "@/lib/nav";
import { getStreamTitleById, streamWatchUrl } from "@/lib/stream";

interface FilmDetailProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: FilmDetailProps): Promise<Metadata> {
  const { id } = await params;
  const catalog = await getCatalog();
  const film = await catalog.getFilm(id);
  if (!film && id.startsWith("stream-")) {
    const title = await getStreamTitleById(id).catch(() => null);
    return {
      title: title?.title ?? "Filme não encontrado",
      description: title?.synopsis,
    };
  }
  return {
    title: film && film.status === "published" ? film.title : "Filme não encontrado",
    description: film?.synopsis,
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

export default async function FilmDetailPage({ params }: FilmDetailProps) {
  const { id } = await params;
  const catalog = await getCatalog();
  const film = await catalog.getFilm(id);

  // Título externo (TMDB): exibe metadados + link oficial de onde assistir.
  if (!film && id.startsWith("stream-")) {
    const title = await getStreamTitleById(id).catch(() => null);
    if (!title) notFound();
    const watchUrl = streamWatchUrl(title);
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
          </div>
        </div>
      </article>
    );
  }

  if (!film || film.status !== "published") notFound();

  const media = film.mediaFileId ? await catalog.getMediaFile(film.mediaFileId) : null;
  const src = media ? toPlayableUrl(media) : null;
  const playHref = filmPlayHref(film);

  return (
    <article className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6">
      {/* Faixa de fundo */}
      <div className="relative -mx-4 mb-8 h-48 overflow-hidden rounded-none bg-gradient-to-br from-accent-soft via-surface-strong to-surface sm:-mx-6 sm:h-64 sm:rounded-2xl">
        {film.backdropUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={film.backdropUrl}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : null}
      </div>

      <div className="flex flex-col gap-8 md:flex-row md:gap-10">
        <div className="w-40 flex-none sm:w-56">
          <PosterCard
            href={playHref ?? `/filmes/${film.id}`}
            title={film.title}
            posterUrl={film.posterUrl}
            badge={film.ageRating ?? undefined}
          />
        </div>

        <div className="flex-1">
          <h1 className="text-3xl font-black tracking-tight text-ink sm:text-4xl">{film.title}</h1>
          <p className="mt-3 leading-relaxed text-foreground/90">{film.synopsis}</p>

          <div className="mt-5 flex flex-wrap gap-2">
            {film.genres.map((genre) => (
              <Link
                key={genre}
                href={`/filmes?genero=${encodeURIComponent(genre)}`}
                className="rounded-full bg-accent-soft px-3 py-1 text-xs font-bold capitalize text-accent-strong transition-colors hover:bg-accent-line"
              >
                {genre}
              </Link>
            ))}
          </div>

          <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {film.year ? <MetaItem label="Ano" value={String(film.year)} /> : null}
            {film.durationMinutes ? (
              <MetaItem label="Duração" value={`${film.durationMinutes} min`} />
            ) : null}
            {film.ageRating ? <MetaItem label="Classificação" value={film.ageRating} /> : null}
            {film.language ? <MetaItem label="Idioma" value={film.language} /> : null}
            {film.subtitles.length > 0 ? (
              <MetaItem label="Legendas" value={film.subtitles.join(", ")} />
            ) : null}
          </dl>

          <div className="mt-8 flex flex-wrap gap-3">
            {playHref && src ? (
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
    </article>
  );
}
