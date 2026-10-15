// ─────────────────────────────────────────────────────────────
// FLOW IPTV — camada de catálogo (interface + seleção do adaptador)
//
// Padrão de repositório: a aplicação conversa com a interface
// CatalogAdapter. O adaptador concreto é escolhido pela env
// DATA_SOURCE:
//   - "json"      → data/catalog/*.json (funciona sem conta nenhuma;
//                   catálogo somente-leitura)
//   - "supabase"  → PostgreSQL + RLS no Supabase (autenticação e
//                   escrita de histórico/favoritos incluídas)
// ─────────────────────────────────────────────────────────────

import "server-only";

import { JsonAdapter } from "@/lib/adapters/json-adapter";
import { SupabaseAdapter } from "@/lib/adapters/supabase-adapter";
import type {
  CatalogStats,
  Film,
  HomeSection,
  MediaFile,
  SearchResults,
  Series,
  ShortDrama,
} from "@/types";

export type DataSourceName = "json" | "supabase";

export interface CatalogAdapter {
  readonly name: DataSourceName;

  getHomeSections(): Promise<HomeSection[]>;
  listFilms(): Promise<Film[]>;
  getFilm(id: string): Promise<Film | null>;
  listSeries(): Promise<Series[]>;
  getSeries(id: string): Promise<Series | null>;
  listShorts(): Promise<ShortDrama[]>;
  getShort(id: string): Promise<ShortDrama | null>;
  search(query: string): Promise<SearchResults>;
  getMediaFile(id: string): Promise<MediaFile | null>;
  getStats(): Promise<CatalogStats>;
}

export function hasSupabaseEnv(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

let cachedAdapter: CatalogAdapter | null = null;

export async function getCatalog(): Promise<CatalogAdapter> {
  if (cachedAdapter) return cachedAdapter;
  const source = (process.env.DATA_SOURCE ?? "json") as DataSourceName;
  if (source === "supabase" && hasSupabaseEnv()) {
    cachedAdapter = new SupabaseAdapter();
  } else {
    cachedAdapter = new JsonAdapter();
  }
  return cachedAdapter;
}

// Resolve a URL reproduzível de um MediaFile (client-safe).
// "local" → rota de streaming com Range do próprio servidor;
// "url"   → URL externa autorizada (validação de domínio acontece na importação);
// "mux"   → playback URL do provider (Etapa 10/11).
export function toPlayableUrl(media: MediaFile): string | null {
  switch (media.provider) {
    case "local":
      return `/api/media/${encodeURIComponent(media.id)}`;
    case "url":
      return media.src;
    case "mux":
      return media.src.startsWith("https://")
        ? media.src
        : `https://stream.mux.com/${media.src}.m3u8`;
    case "drive":
      // O navegador NÃO acessa drive.usercontent direto (CORS bloqueado).
      // Proxy do servidor: /api/media faz Range ao Drive e serve pro player.
      return `/api/media/${encodeURIComponent(media.id)}`;
    default:
      return null;
  }
}

export { JsonAdapter, SupabaseAdapter };
