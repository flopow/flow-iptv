// ─────────────────────────────────────────────────────────────
// FLOW IPTV — tipos do banco (Supabase/PostgreSQL)
//
// Forma validada na fronteira com o banco: o SupabaseClient tipa
// cada consulta com estes Row types — sem casts inline de membros.
// Espelha supabase/migrations/0001_init.sql.
//
// Formato: mapa de schema → GenericSchema (mesmo shape dos tipos
// gerados pelo Supabase CLI), com o schema padrão "public".
// ─────────────────────────────────────────────────────────────

export type FilmRow = {
  id: string;
  slug: string;
  title: string;
  synopsis: string | null;
  poster_url: string | null;
  backdrop_url: string | null;
  year: number | null;
  genres: string[] | null;
  duration_minutes: number | null;
  age_rating: string | null;
  language: string | null;
  subtitles: string[] | null;
  media_file_id: string | null;
  status: string;
  featured: boolean;
  created_at: string;
}

export type EpisodeRow = {
  id: string;
  season_id: string;
  number: number;
  title: string;
  synopsis: string | null;
  duration_minutes: number | null;
  thumb_url: string | null;
  media_file_id: string | null;
}

export type SeasonRow = {
  id: string;
  series_id: string;
  number: number;
  title: string | null;
}

export type ShortEpisodeRow = {
  id: string;
  short_id: string;
  number: number;
  title: string;
  duration_seconds: number | null;
  thumb_url: string | null;
  media_file_id: string | null;
}

export type MediaFileRow = {
  id: string;
  provider: "local" | "url" | "mux";
  format: "mp4" | "mkv" | "hls" | "webm";
  src: string;
  size_bytes: number | null;
  duration_seconds: number | null;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      films: { Row: FilmRow; Insert: never; Update: never; Relationships: [] };
      series: { Row: FilmRow; Insert: never; Update: never; Relationships: [] };
      seasons: { Row: SeasonRow; Insert: never; Update: never; Relationships: [] };
      episodes: { Row: EpisodeRow; Insert: never; Update: never; Relationships: [] };
      short_dramas: { Row: FilmRow; Insert: never; Update: never; Relationships: [] };
      short_episodes: { Row: ShortEpisodeRow; Insert: never; Update: never; Relationships: [] };
      media_files: { Row: MediaFileRow; Insert: never; Update: never; Relationships: [] };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type TableRow<K extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][K]["Row"];
