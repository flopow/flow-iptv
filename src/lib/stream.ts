// ─────────────────────────────────────────────────────────────
// FLOW IPTV — catálogo por plataforma de streaming via TMDB.
// Metadados públicos (título, pôster, sinopse, ano, gênero), sem
// login em nenhum serviço. Filtro oficial por provider + região BR.
//
// Env: TMDB_API_KEY (themoviedb.org → API → chave gratuita, sem cartão)
//      STREAM_WATCH_REGION (padrão: BR)
// ─────────────────────────────────────────────────────────────

import "server-only";

export type StreamPlatform =
  | "netflix"
  | "amazon"
  | "apple"
  | "disney"
  | "max"
  | "paramount";

export interface StreamPlatformInfo {
  id: StreamPlatform;
  label: string;
  tmdbProviderId: number;
}

export const STREAM_PLATFORMS: StreamPlatformInfo[] = [
  { id: "netflix", label: "Netflix", tmdbProviderId: 8 },
  { id: "amazon", label: "Amazon Prime Video", tmdbProviderId: 119 },
  { id: "apple", label: "Apple TV+", tmdbProviderId: 350 },
  { id: "disney", label: "Disney+", tmdbProviderId: 337 },
  { id: "max", label: "Max", tmdbProviderId: 384 },
  { id: "paramount", label: "Paramount+", tmdbProviderId: 531 },
];

export interface StreamTitle {
  id: string;
  title: string;
  synopsis: string;
  posterUrl: string | null;
  year: number | null;
  genres: string[];
  kind: "film" | "series";
  tmdbId: number;
}

const TMDB_BASE = "https://api.themoviedb.org/3";
const WATCH_REGION = process.env.STREAM_WATCH_REGION ?? "BR";
const IMAGE_BASE = "https://image.tmdb.org/t/p/w500";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h

interface TmdbItem {
  id: number;
  title?: string;
  name?: string;
  overview?: string;
  poster_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  genre_ids?: number[];
}

const GENRE_NAMES: Record<number, string> = {
  28: "Ação", 12: "Aventura", 16: "Animação", 35: "Comédia", 80: "Crime",
  99: "Documentário", 18: "Drama", 10751: "Família", 14: "Fantasia",
  36: "História", 27: "Terror", 10402: "Música", 9648: "Mistério",
  10749: "Romance", 878: "Ficção científica", 10770: "TV", 53: "Thriller",
  10752: "Guerra", 37: "Faroeste",
};

export function hasStreamKey(): boolean {
  return Boolean(process.env.TMDB_API_KEY);
}

let cache: { at: number; key: string; data: StreamTitle[] } | null = null;

function genresOf(ids: number[] | undefined): string[] {
  if (!ids) return [];
  return ids
    .map((id) => GENRE_NAMES[id])
    .filter((name): name is string => Boolean(name))
    .slice(0, 3);
}

function toTitle(raw: TmdbItem, kind: "film" | "series"): StreamTitle {
  const title = (raw.title ?? raw.name ?? "").trim();
  const year =
    Number((kind === "film" ? raw.release_date : raw.first_air_date)?.slice(0, 4) || 0) || null;
  return {
    id: `stream-${kind}-${raw.id}`,
    title,
    synopsis: raw.overview ?? "",
    posterUrl: raw.poster_path ? `${IMAGE_BASE}${raw.poster_path}` : null,
    year,
    genres: genresOf(raw.genre_ids),
    kind,
    tmdbId: raw.id,
  };
}

/** Títulos de UMA plataforma (filmes + séries, pt-BR) — cache 6h. */
export async function getPlatformCatalog(
  platform: StreamPlatformInfo,
  limit = 40,
): Promise<StreamTitle[]> {
  if (!hasStreamKey()) throw new Error("TMDB_API_KEY ausente");

  const cacheKey = `${platform.id}:${limit}`;
  if (cache && cache.key === cacheKey && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.data;
  }

  const fetchDiscover = async (kind: "movie" | "tv"): Promise<StreamTitle[]> => {
    const url = new URL(`${TMDB_BASE}/discover/${kind}`);
    url.searchParams.set("api_key", process.env.TMDB_API_KEY!);
    url.searchParams.set("with_watch_providers", String(platform.tmdbProviderId));
    url.searchParams.set("watch_region", WATCH_REGION);
    url.searchParams.set("sort_by", "popularity.desc");
    url.searchParams.set("with_original_language", "pt");
    url.searchParams.set("language", "pt-BR");
    url.searchParams.set("page", "1");
    const res = await fetch(url, { headers: { Accept: "application/json" }, next: { revalidate: 21600 } });
    if (!res.ok) throw new Error(`TMDB ${kind}: ${res.status}`);
    const json = (await res.json()) as { results?: TmdbItem[] };
    return (json.results ?? [])
      .filter((r) => r.title ?? r.name)
      .map((r) => toTitle(r, kind === "movie" ? "film" : "series"));
  };

  const [films, series] = await Promise.all([
    fetchDiscover("movie"),
    fetchDiscover("tv"),
  ]);
  const data = [...films, ...series];
  cache = { at: Date.now(), key: cacheKey, data };
  return data;
}
