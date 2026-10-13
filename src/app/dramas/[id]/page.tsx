import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PosterCard } from "@/components/ui/PosterCard";
import { PlayIcon } from "@/components/ui/icons";
import { getCatalog } from "@/lib/catalog";
import { shortPlayHref } from "@/lib/nav";

interface ShortDetailProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: ShortDetailProps): Promise<Metadata> {
  const { id } = await params;
  const catalog = await getCatalog();
  const short = await catalog.getShort(id);
  return {
    title: short && short.status === "published" ? short.title : "Drama não encontrado",
    description: short?.synopsis,
  };
}

export default async function ShortDetailPage({ params }: ShortDetailProps) {
  const { id } = await params;
  const catalog = await getCatalog();
  const short = await catalog.getShort(id);
  if (!short || short.status !== "published") notFound();

  const playHref = shortPlayHref(short);
  const playableEpisodes = short.episodes.filter((e) => e.mediaFileId).length;

  return (
    <article className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6">
      <div className="flex flex-col gap-8 md:flex-row md:gap-10">
        <div className="mx-auto w-44 flex-none sm:w-56">
          <PosterCard
            href={`/dramas/${short.id}`}
            title={short.title}
            posterUrl={short.posterUrl}
            badge={short.ageRating ?? undefined}
            aspect="vertical"
          />
        </div>

        <div className="flex-1">
          <h1 className="text-3xl font-black tracking-tight text-ink sm:text-4xl">{short.title}</h1>
          <p className="mt-3 leading-relaxed text-foreground/90">{short.synopsis}</p>

          <div className="mt-5 flex flex-wrap gap-2">
            {short.genres.map((genre) => (
              <span
                key={genre}
                className="rounded-full bg-accent-soft px-3 py-1 text-xs font-bold capitalize text-accent-strong"
              >
                {genre}
              </span>
            ))}
          </div>

          <p className="mt-5 text-sm text-muted">
            {short.episodes.length} episódios · {playableEpisodes} disponíveis
            {short.year ? ` · ${short.year}` : ""} · classificação {short.ageRating ?? "L"}
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

      <section className="mt-12" aria-label="Episódios">
        <h2 className="mb-4 text-lg font-bold text-ink">Episódios</h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {short.episodes.map((episode) => (
            <li
              key={episode.id}
              className="flex items-center gap-4 rounded-xl border border-line bg-surface px-4 py-3 transition-colors hover:border-accent-line"
            >
              <span className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-accent-soft text-sm font-black text-accent">
                {episode.number}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-foreground">{episode.title}</p>
                <p className="text-xs text-muted">
                  {episode.durationSeconds ? `${Math.round(episode.durationSeconds / 60)} min` : ""}
                </p>
              </div>
              {episode.mediaFileId ? (
                <Link
                  href={`/player/drama/${short.id}?ep=${episode.id}`}
                  className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-accent text-white transition-colors hover:bg-accent-strong"
                  aria-label={`Assistir episódio ${episode.number}`}
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
          ))}
        </ul>
      </section>
    </article>
  );
}
