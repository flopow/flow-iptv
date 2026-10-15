// ─────────────────────────────────────────────────────────────
// FLOW IPTV — tipos de domínio do catálogo
// ─────────────────────────────────────────────────────────────

export type PublicationStatus = "draft" | "published";

export type AgeRating = "L" | "10" | "12" | "14" | "16" | "18";

export type MediaProviderName = "local" | "url" | "mux" | "drive";

export type MediaFormat = "mp4" | "mkv" | "hls" | "webm";

// Arquivo de mídia: guarda APENAS metadados e referência.
// O binário fica no provider (disco local, URL autorizada, ou futuramente Mux/Bunny).
export interface MediaFile {
  id: string;
  provider: MediaProviderName;
  format: MediaFormat;
  src: string;
  sizeBytes: number | null;
  durationSeconds: number | null;
  createdAt: string;
}

export interface Film {
  id: string;
  title: string;
  synopsis: string;
  posterUrl: string | null;
  backdropUrl: string | null;
  year: number | null;
  genres: string[];
  durationMinutes: number | null;
  ageRating: AgeRating | null;
  language: string | null;
  subtitles: string[];
  mediaFileId: string | null;
  status: PublicationStatus;
  featured: boolean;
  createdAt: string;
}

export interface Episode {
  id: string;
  number: number;
  title: string;
  synopsis: string | null;
  durationMinutes: number | null;
  thumbUrl: string | null;
  mediaFileId: string | null;
  subtitleUrl?: string | null;
}

export interface Season {
  id: string;
  number: number;
  title: string;
  episodes: Episode[];
}

export interface Series {
  id: string;
  title: string;
  synopsis: string;
  posterUrl: string | null;
  backdropUrl: string | null;
  year: number | null;
  genres: string[];
  ageRating: AgeRating | null;
  language: string | null;
  subtitles: string[];
  status: PublicationStatus;
  featured: boolean;
  createdAt: string;
  seasons: Season[];
}

export interface ShortEpisode {
  id: string;
  number: number;
  title: string;
  durationSeconds: number | null;
  thumbUrl: string | null;
  mediaFileId: string | null;
  subtitleUrl?: string | null;
}

export interface ShortDrama {
  id: string;
  title: string;
  synopsis: string;
  posterUrl: string | null;
  backdropUrl: string | null;
  year: number | null;
  genres: string[];
  ageRating: AgeRating | null;
  language: string | null;
  status: PublicationStatus;
  featured: boolean;
  createdAt: string;
  episodes: ShortEpisode[];
}

export interface HomeSection {
  id: string;
  title: string;
  seeAllHref: string | null;
  kind: "films" | "series" | "shorts";
  items: (Film | Series | ShortDrama)[];
}

export interface SearchResults {
  films: Film[];
  series: Series[];
  shorts: ShortDrama[];
}

export interface CatalogStats {
  films: number;
  series: number;
  shorts: number;
  publishedFilms: number;
  publishedSeries: number;
  publishedShorts: number;
}
