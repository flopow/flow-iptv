// ─────────────────────────────────────────────────────────────
// FLOW IPTV — animes com vídeo (streaming HLS via consumet).
// Providers: Hianime (catálogo completo) com fallback AnimeUnity.
// Nenhum metadado local: busca/info/stream resolvidos em tempo
// real no servidor; o player toca HLS direto (CORS aberto).
// ─────────────────────────────────────────────────────────────

import "server-only";

// Import direto dos módulos (o index do pacote puxa AnimeSama, que
// depende de got-scraping com exports quebrados — quebraria o build).
import HianimeProvider from "@consumet/extensions/dist/providers/anime/hianime";
import AnimeUnityProvider from "@consumet/extensions/dist/providers/anime/animeunity";

type Hianime = HianimeProvider;
type AnimeUnity = AnimeUnityProvider;

export type AnimeProvider = "hianime" | "animeunity";

export interface AnimeTitle {
  id: string; // "<provider>:<rawId>"
  provider: AnimeProvider;
  title: string;
  type: string | null;
  episodeCount: number | null;
  year: number | null;
  status: string;
  rating: number | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  genres: string[];
  synopsis: string;
  rawId: string;
}

export interface AnimeEpisode {
  id: string;
  number: number;
  title: string | null;
}

export interface AnimeDetail extends AnimeTitle {
  episodes: AnimeEpisode[];
}

export interface AnimeCategory {
  type: string;
  count: number | null;
}

const TYPE_LABELS: Record<string, string> = {
  TV: "Séries TV",
  MOVIE: "Filmes",
  OVA: "OVA",
  ONA: "ONA",
  SPECIAL: "Especiais",
};

const CACHE_TTL_SEARCH = 10 * 60 * 1000; // busca/info: 10min
const CACHE_TTL_STREAM = 30 * 60 * 1000; // stream: 30min (token expira ~1-2h)

// Listas por tipo do Hianime (uma chamada por categoria).
const TYPE_FETCHERS: Record<string, () => Promise<{ results?: unknown[] }>> = {
  TV: () => hianime().fetchTV(1),
  MOVIE: () => hianime().fetchMovie(1),
  OVA: () => hianime().fetchOVA(1),
  ONA: () => hianime().fetchONA(1),
  SPECIAL: () => hianime().fetchSpecial(1),
};

let searchCache: { key: string; at: number; data: AnimeTitle[] } | null = null;
const streamCache: Map<string, { at: number; url: string | null }> = new Map();

function hianime(): Hianime {
  return new HianimeProvider();
}

function animeunity(): AnimeUnity {
  return new AnimeUnityProvider();
}

function toAnimeTitle(raw: Record<string, unknown>, provider: AnimeProvider): AnimeTitle {
  const title =
    typeof raw.title === "string"
      ? raw.title
      : typeof raw.name === "string"
        ? raw.name
        : "Sem título";
  const type =
    typeof raw.type === "string" && raw.type
      ? raw.type.toUpperCase()
      : typeof raw.subOrDub === "string"
        ? "TV"
        : null;
  const episodeCount = typeof raw.totalEpisodes === "number" ? raw.totalEpisodes : null;
  const year = (() => {
    const releaseDate = typeof raw.releaseDate === "string" ? raw.releaseDate : "";
    const m = /(\d{4})/.exec(releaseDate);
    if (m) return Number(m[1]);
    return null;
  })();
  const rating = typeof raw.rating === "number" ? raw.rating : null;
  const genres = Array.isArray(raw.genres)
    ? (raw.genres as string[]).filter((g) => typeof g === "string")
    : [];
  const rawId = typeof raw.id === "string" ? raw.id : title.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  return {
    id: `${provider}:${rawId}`,
    provider,
    title,
    type,
    episodeCount,
    year,
    status: typeof raw.status === "string" ? raw.status : "Em exibição",
    rating,
    posterUrl: typeof raw.image === "string" ? raw.image : null,
    backdropUrl: typeof raw.cover === "string" ? raw.cover : null,
    genres,
    synopsis: typeof raw.description === "string" ? raw.description : "",
    rawId,
  };
}

/** Busca por termo (fallback entre providers). */
export async function searchAnime(query: string, limit = 30): Promise<AnimeTitle[]> {
  const key = `${query}:${limit}`;
  if (searchCache && searchCache.key === key && Date.now() - searchCache.at < CACHE_TTL_SEARCH) {
    return searchCache.data;
  }

  // Hianime primeiro (catálogo maior); AnimeUnity de reserva.
  try {
    const res = await hianime().search(query.trim() || "top", 1);
    const results = (res.results ?? []).map((r) => toAnimeTitle(r as Record<string, unknown>, "hianime"));
    if (results.length > 0) {
      searchCache = { key, at: Date.now(), data: results };
      return results;
    }
  } catch {
    // provider fora do ar → fallback
  }

  try {
    const fallback = await animeunity().search(query.trim() || "");
    const results = (fallback.results ?? [])
      .slice(0, limit)
      .map((r) => toAnimeTitle(r as Record<string, unknown>, "animeunity"));
    if (results.length > 0) {
      searchCache = { key, at: Date.now(), data: results };
      return results;
    }
  } catch {
    // ambos fora do ar
  }

  searchCache = { key, at: Date.now(), data: [] };
  return [];
}

/** Títulos de uma categoria (tipo) com busca opcional. */
export async function listAnimeByType(
  type: string,
  query = "",
  limit = 60,
): Promise<AnimeTitle[]> {
  if (query.trim()) return searchAnime(query, limit);

  // Hianime tem listas por tipo; AnimeUnity só busca livre.
  const fetcher = TYPE_FETCHERS[type.toUpperCase()];
  if (fetcher) {
    try {
      const res = await fetcher();
      const results = (res.results ?? []).map((r) => toAnimeTitle(r as Record<string, unknown>, "hianime"));
      if (results.length > 0) return results.slice(0, limit);
    } catch {
      // fallback abaixo
    }
  }

  return searchAnime("", limit);
}

/** Categorias com contagem — usado nos chips da aba Animes. */
export async function animeCategories(): Promise<{ type: string; count: number | null }[]> {
  const types = ["TV", "MOVIE", "OVA", "ONA", "SPECIAL"];
  const out: { type: string; count: number | null }[] = [];

  // Tenta contagens reais via Hianime (uma chamada por tipo).
  try {
    for (const type of types) {
      const fetcher = TYPE_FETCHERS[type];
      const res = await fetcher();
      out.push({ type, count: (res.results ?? []).length });
    }
    return out;
  } catch {
    // provider fora do ar → chips sem contagem
  }

  return types.map((type) => ({ type, count: null }));
}

export function animeTypeLabel(type: string | null): string {
  return type ? (TYPE_LABELS[type.toUpperCase()] ?? type) : "Anime";
}

/** Detalhe com episódios (o id já carrega o provider). */
export async function getAnimeById(id: string): Promise<AnimeDetail | null> {
  const [providerRaw, rawId] = id.split(":");
  if (!providerRaw || !rawId) return null;

  const provider = providerRaw as AnimeProvider;
  try {
    let info: Record<string, unknown>;
    if (provider === "hianime") {
      const res = await hianime().fetchAnimeInfo(rawId);
      info = res as unknown as Record<string, unknown>;
    } else {
      const res = await animeunity().fetchAnimeInfo(rawId);
      info = res as unknown as Record<string, unknown>;
    }

    const title = toAnimeTitle(info, provider);
    const episodes: AnimeEpisode[] = (Array.isArray(info.episodes) ? info.episodes : [])
      .map((e) => {
        const ep = e as Record<string, unknown>;
        return {
          id: typeof ep.id === "string" ? ep.id : `${rawId}/${ep.number}`,
          number: typeof ep.number === "number" ? ep.number : 0,
          title: typeof ep.title === "string" ? ep.title : `Episódio ${ep.number}`,
        };
      })
      .sort((a, b) => a.number - b.number);

    return { ...title, episodes };
  } catch {
    return null;
  }
}

/** URL de stream HLS do episódio (melhor qualidade disponível). */
export async function resolveEpisodeStream(
  provider: AnimeProvider,
  episodeId: string,
): Promise<string | null> {
  const key = `${provider}:${episodeId}`;
  const cached = streamCache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_STREAM) return cached.url;

  let url: string | null = null;
  try {
    if (provider === "hianime") {
      const res = await hianime().fetchEpisodeSources(episodeId);
      url = pickBestSource(res.sources ?? []);
    } else {
      const res = await animeunity().fetchEpisodeSources(episodeId);
      url = pickBestSource(res.sources ?? []);
    }
  } catch {
    url = null;
  }

  streamCache.set(key, { at: Date.now(), url });
  return url;
}

function pickBestSource(sources: { url?: string; quality?: string; isM3U8?: boolean }[]): string | null {
  const hls = sources.filter((s) => s.isM3U8 !== false && s.url);
  if (hls.length === 0) return null;
  const rank = { "1080p": 5, "720p": 4, "480p": 3, "360p": 2, default: 1 };
  const best = hls.sort((a, b) => (rank[b.quality as keyof typeof rank] ?? 0) - (rank[a.quality as keyof typeof rank] ?? 0))[0];
  return best.url ?? null;
}
