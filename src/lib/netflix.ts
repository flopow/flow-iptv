// ─────────────────────────────────────────────────────────────
// FLOW IPTV — catálogo Netflix via uNoGS (API não-oficial de
// metadados, pública). Só metadados: título, pôster, sinopse,
// ano, gênero. Sem login na Netflix, sem contornar segurança.
//
// Env: NETFLIX_RAPIDAPI_KEY (chave gratuita do RapidAPI — uNoGS)
//      NETFLIX_RAPIDAPI_HOST (padrão: unogs-unogs-v1.p.rapidapi.com)
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
  netflixId: string;
}

interface UnogsResult {
  title: string;
  year: number | null;
  imdbid: string | null;
  netflixid: string | null;
  img: string | null;
  synopsis: string | null;
  genre: string | null;
  type: string | null;
}

const RAPID_HOST =
  process.env.NETFLIX_RAPIDAPI_HOST ?? "unogs-unogs-v1.p.rapidapi.com";

export function hasNetflixKey(): boolean {
  return Boolean(process.env.NETFLIX_RAPIDAPI_KEY);
}

let cache: { at: number; data: NetflixTitle[] } | null = null;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h (free tier tem cota pequena)

function toGenres(genre: string | null): string[] {
  if (!genre) return [];
  return genre
    .split(",")
    .map((g) => g.trim())
    .filter(Boolean)
    .slice(0, 3);
}

/** Busca o catálogo (limitado a `limit` por tipo) com cache em memória. */
export async function getNetflixCatalog(
  limit = 50,
): Promise<NetflixTitle[]> {
  if (!hasNetflixKey()) {
    throw new Error("NETFLIX_RAPIDAPI_KEY ausente");
  }
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.data.slice(0, limit);
  }

  const headers = {
    "x-rapidapi-key": process.env.NETFLIX_RAPIDAPI_KEY!,
    "x-rapidapi-host": RAPID_HOST,
    "User-Agent": "flow-iptv/0.1",
  };
  const base = `https://${RAPID_HOST}`;

  // uNoGS: busca títulos com filtros por tipo e ordenação por data.
  async function fetchType(type: "movie" | "series"): Promise<NetflixTitle[]> {
    const url = new URL(`${base}/search/titles`);
    url.searchParams.set("order_by", "date");
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("type", type);
    const res = await fetch(url, { headers, next: { revalidate: 21600 } });
    if (!res.ok) {
      throw new Error(`uNoGS ${type}: ${res.status}`);
    }
    const json = (await res.json()) as { results?: UnogsResult[] };
    const items = json.results ?? [];
    return items
      .filter((r) => r.title)
      .map((r) => ({
        id: `netflix-${r.netflixid ?? r.imdbid ?? r.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")}`,
        title: r.title,
        synopsis: r.synopsis ?? "",
        posterUrl: r.img
          ? (r.img.startsWith("http") ? r.img : `https:${r.img}`)
          : null,
        year: r.year,
        genres: toGenres(r.genre),
        type: type === "movie" ? "film" : "series",
        netflixId: r.netflixid ?? r.imdbid ?? "",
      }));
  }

  const [films, series] = await Promise.all([
    fetchType("movie").catch(() => [] as NetflixTitle[]),
    fetchType("series").catch(() => [] as NetflixTitle[]),
  ]);

  const data = [...films, ...series];
  cache = { at: Date.now(), data };
  return data.slice(0, limit);
}
