// ─────────────────────────────────────────────────────────────
// FLOW IPTV — catálogo "Netflix" via TMDB (API gratuita, sem cartão,
// milhares de req/dia). Metadados públicos: título, pôster, sinopse,
// ano, gênero. Filtro oficial de disponibilidade por provider
// (Netflix = provider id 8) e região (padrão BR). Sem login na
// Netflix, sem contornar segurança.
//
// Env: TMDB_API_KEY (themoviedb.org → Settings → API → chave gratuita)
//      NETFLIX_WATCH_REGION (padrão: BR)
// ─────────────────────────────────────────────────────────────

import "server-only";

export interface NetflixTitle {
  id: string;
  title: string;
  synopsis: string;
  posterUrl: string | null;
  year: number | null;
  genres: string[];
  type: "film" | "series";
  tmdbId: number;
}

const TMDB_BASE = "https://api.themoviedb.org/3";
const NETFLIX_PROVIDER_ID = 8;
const WATCH_REGION = process.env.NETFLIX_WATCH_REGION ?? "BR";
const IMAGE_BASE = "https://image.tmdb.org/t/p/w500";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h (evita queimar cota)

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

export function hasNetflixKey(): boolean {
  return Boolean(process.env.TMDB_API_KEY);
}

let cache: { at: number; data: NetflixTitle[] } | null = null;

function genresOf(ids: number[] | undefined): string[] {
  if (!ids) return [];
  return ids
    .map((id) => GENRE_NAMES[id])
    .filter((name): name is string => Boolean(name))
    .slice(0, 3);
}

function toTitle(raw: TmdbItem, type: "film" | "series"): NetflixTitle {
  const title = (raw.title ?? raw.name ?? "").trim();
  const year = Number((type === "film" ? raw.release_date : raw.first_air_date)?.slice(0, 4) || 0) || null;
  return {
    id: `netflix-${type}-${raw.id}`,
    title,
    synopsis: raw.overview ?? "",
    posterUrl: raw.poster_path ? `${IMAGE_BASE}${raw.poster_path}` : null,
    year,
    genres: genresOf(raw.genre_ids),
    type,
    tmdbId: raw.id,
  };
}

/** Títulos disponíveis na Netflix (region) — cache 6h em memória. */
export async function getNetflixCatalog(limit = 50): Promise<NetflixTitle[]> {
  if (!hasNetflixKey()) {
    throw new Error("TMDB_API_KEY ausente");
  }
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.data.slice(0, limit);
  }

  const headers = { Authorization: `Bearer ${process.env.TMDB_API_KEY}` };
  const fetchDiscover = async (kind: "movie" | "tv"): Promise<NetflixTitle[]> => {
    const url = new URL(`${TMDB_BASE}/discover/${kind}`);
    url.searchParams.set("with_watch_providers", String(NETFLIX_PROVIDER_ID));
    url.searchParams.set("watch_region", WATCH_REGION);
    url.searchParams.set("sort_by", "popularity.desc");
    url.searchParams.set("with_original_language", "pt");
    url.searchParams.set("language", "pt-BR");
    url.searchParams.set("page", "1");
    const res = await fetch(url, { headers, next: { revalidate: 21600 } });
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
  cache = { at: Date.now(), data };
  return data.slice(0, limit);
}
