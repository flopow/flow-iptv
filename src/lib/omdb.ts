// ─────────────────────────────────────────────────────────────
// FLOW IPTV — fonte OMDb (omdbapi.com). Metadados públicos de
// filmes/séries/TV: pôster, ano, gênero, sinopse. Usado como
// fonte extra além do TMDB (mais resultados = melhor).
//
// Env: OMDB_API_KEY (omdbapi.com → chave gratuita)
// ─────────────────────────────────────────────────────────────

import "server-only";

import type { StreamTitle } from "@/lib/stream";

const OMDB_BASE = "http://www.omdbapi.com/";

export function hasOmdbKey(): boolean {
  return Boolean(process.env.OMDB_API_KEY);
}

interface OmdbItem {
  Title?: string;
  Year?: string;
  Poster?: string;
  Genre?: string;
  Type?: "movie" | "series" | "episode";
  imdbID?: string;
  Plot?: string;
  totalResults?: string;
}

function toStreamTitle(raw: OmdbItem): StreamTitle | null {
  const kind = raw.Type === "series" ? "series" : raw.Type === "movie" ? "film" : null;
  if (!kind || !raw.Title) return null;
  return {
    id: `omdb-${kind}-${raw.imdbID ?? raw.Title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    title: raw.Title,
    synopsis: raw.Plot ?? "",
    posterUrl: raw.Poster && raw.Poster !== "N/A" ? raw.Poster : null,
    year: Number(raw.Year?.slice(0, 4)) || null,
    genres: (raw.Genre ?? "").split(",").map((g) => g.trim()).filter(Boolean).slice(0, 3),
    kind,
    tmdbId: 0,
  };
}

/** Busca por termo (fonte extra além do TMDB). */
export async function omdbSearch(query: string, limit = 20): Promise<StreamTitle[]> {
  if (!hasOmdbKey()) return [];
  const url = new URL(OMDB_BASE);
  url.searchParams.set("apikey", process.env.OMDB_API_KEY!);
  url.searchParams.set("s", query);
  url.searchParams.set("type", "all");
  const res = await fetch(url, { headers: { "User-Agent": "flow-iptv/0.1" }, next: { revalidate: 86400 } });
  if (!res.ok) return [];
  const json = (await res.json()) as { Search?: OmdbItem[]; Response?: string };
  if (json.Response !== "True") return [];
  return (json.Search ?? []).map(toStreamTitle).filter((t): t is StreamTitle => t !== null).slice(0, limit);
}

/** Detalhe por id IMDb (fallback de página de detalhe). */
export async function omdbById(imdbId: string): Promise<StreamTitle | null> {
  if (!hasOmdbKey()) return null;
  const url = new URL(OMDB_BASE);
  url.searchParams.set("apikey", process.env.OMDB_API_KEY!);
  url.searchParams.set("i", imdbId);
  url.searchParams.set("plot", "full");
  const res = await fetch(url, { headers: { "User-Agent": "flow-iptv/0.1" }, next: { revalidate: 86400 } });
  if (!res.ok) return null;
  const json = (await res.json()) as OmdbItem;
  return toStreamTitle(json);
}
