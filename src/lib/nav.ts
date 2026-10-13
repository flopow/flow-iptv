import type { Film, Series, ShortDrama } from "@/types";

// Links canônicos de detalhe/reprodução usados em server components.

export function itemDetailHref(item: Film | Series | ShortDrama): string {
  if ("seasons" in item) return `/series/${item.id}`;
  if ("episodes" in item) return `/dramas/${item.id}`;
  return `/filmes/${item.id}`;
}

export function filmPlayHref(film: Film): string | null {
  return film.mediaFileId ? `/player/filme/${film.id}` : null;
}

export function seriesPlayHref(series: Series): string | null {
  const firstPlayable = series.seasons
    .flatMap((s) => s.episodes)
    .find((e) => e.mediaFileId);
  return firstPlayable ? `/player/serie/${series.id}?ep=${firstPlayable.id}` : null;
}

export function shortPlayHref(short: ShortDrama): string | null {
  const firstPlayable = short.episodes.find((e) => e.mediaFileId);
  return firstPlayable ? `/player/drama/${short.id}?ep=${firstPlayable.id}` : null;
}

export function itemPlayHref(item: Film | Series | ShortDrama): string | null {
  if ("seasons" in item) return seriesPlayHref(item);
  if ("episodes" in item) return shortPlayHref(item);
  return filmPlayHref(item);
}

// Links de próximo/anterior dentro da mesma série/drama.
export function episodeNeighbors(
  series: Series,
  currentId: string,
): { prev: { id: string; label: string } | null; next: { id: string; label: string } | null } {
  const flat = series.seasons.flatMap((s) => s.episodes).sort((a, b) => a.number - b.number);
  const index = flat.findIndex((e) => e.id === currentId);
  if (index === -1) return { prev: null, next: null };
  const prev = index > 0 ? flat[index - 1] : null;
  const next = index < flat.length - 1 ? flat[index + 1] : null;
  return {
    prev: prev ? { id: prev.id, label: `E${prev.number} · ${prev.title}` } : null,
    next: next ? { id: next.id, label: `E${next.number} · ${next.title}` } : null,
  };
}

export function shortNeighbors(
  short: ShortDrama,
  currentId: string,
): { prev: { id: string; label: string } | null; next: { id: string; label: string } | null } {
  const sorted = short.episodes.slice().sort((a, b) => a.number - b.number);
  const index = sorted.findIndex((e) => e.id === currentId);
  if (index === -1) return { prev: null, next: null };
  const prev = index > 0 ? sorted[index - 1] : null;
  const next = index < sorted.length - 1 ? sorted[index + 1] : null;
  return {
    prev: prev ? { id: prev.id, label: `Ep. ${prev.number} · ${prev.title}` } : null,
    next: next ? { id: next.id, label: `Ep. ${next.number} · ${next.title}` } : null,
  };
}
