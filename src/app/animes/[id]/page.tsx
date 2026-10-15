import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PlayIcon } from "@/components/ui/icons";
import { animeWatchLinks, getAnimeById } from "@/lib/anime";

interface AnimeDetailProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: AnimeDetailProps): Promise<Metadata> {
  const { id } = await params;
  const anime = await getAnimeById(id).catch(() => null);
  return { title: anime?.title ?? "Anime não encontrado" };
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold text-foreground">{value}</dd>
    </div>
  );
}

export default async function AnimeDetailPage({ params }: AnimeDetailProps) {
  const { id } = await params;
  const anime = await getAnimeById(id).catch(() => null);
  if (!anime) notFound();

  const watchLinks = animeWatchLinks(anime.sources);

  return (
    <article className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6">
      <div className="relative -mx-4 mb-8 h-48 overflow-hidden rounded-none bg-gradient-to-br from-accent-soft via-surface-strong to-surface sm:-mx-6 sm:h-64 sm:rounded-2xl">
        {anime.posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={anime.posterUrl}
            alt=""
            className="h-full w-full object-cover opacity-30"
            loading="lazy"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-6 sm:p-10">
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-accent">Anime</p>
          <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
            {anime.title}
          </h1>
        </div>
      </div>

      <div className="flex flex-col gap-8 md:flex-row md:gap-10">
        <div className="w-40 flex-none sm:w-56">
          {anime.posterUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={anime.posterUrl}
              alt={anime.title}
              className="w-full rounded-2xl border border-line shadow-lg"
              loading="lazy"
            />
          ) : (
            <div className="flex h-72 w-full items-center justify-center rounded-2xl border border-line bg-surface text-5xl font-black text-accent/60">
              {(anime.title.trim().charAt(0) || "A").toUpperCase()}
            </div>
          )}
        </div>

        <div className="flex-1">
          <dl className="mt-2 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {anime.year ? <MetaItem label="Ano" value={String(anime.year)} /> : null}
            {anime.episodes ? (
              <MetaItem label="Episódios" value={String(anime.episodes)} />
            ) : null}
            <MetaItem label="Status" value={anime.status} />
            <MetaItem label="Tipo" value={anime.type} />
          </dl>

          <div className="mt-8">
            <p className="max-w-md text-xs text-muted">
              Este título é exibido como catálogo (metadados públicos). A reprodução acontece nas
              plataformas oficiais onde ele está disponível.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              {watchLinks.length > 0 ? (
                watchLinks.map((link) => (
                  <a
                    key={link.url}
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-bold text-white shadow transition-transform hover:scale-[1.02] hover:bg-accent-strong active:scale-[0.98]"
                  >
                    <PlayIcon className="h-5 w-5" /> Assistir — {link.label}
                  </a>
                ))
              ) : (
                <span className="inline-flex items-center rounded-full bg-surface-strong px-7 py-3.5 text-sm font-bold text-muted">
                  Sem link oficial disponível
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
