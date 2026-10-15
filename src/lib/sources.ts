// ─────────────────────────────────────────────────────────────
// FLOW IPTV — fontes de catálogo ativas/desativadas.
// Estado persistido em data/catalog/stream-sources.json (versionado):
//   { "tmdb": true, "omdb": true, "github": true, "drive": true }
// O admin alterna; as páginas consultam aqui antes de usar a fonte.
// ─────────────────────────────────────────────────────────────

import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

export type SourceName = "tmdb" | "github" | "drive";

export const DEFAULT_SOURCES: Record<SourceName, boolean> = {
  tmdb: true,
  github: true,
  drive: true,
};

export const SOURCE_LABELS: Record<SourceName, string> = {
  tmdb: "TMDB (capas e catálogo externo)",
  github: "GitHub raw (dramas antigos)",
  drive: "Google Drive via proxy (dramas novos)",
};

let cache: Record<SourceName, boolean> | null = null;

export async function getSources(): Promise<Record<SourceName, boolean>> {
  if (cache) return cache;
  try {
    const raw = await readFile(
      path.join(process.cwd(), "data", "catalog", "stream-sources.json"),
      "utf8",
    );
    const parsed = JSON.parse(raw) as Partial<Record<SourceName, boolean>>;
    cache = { ...DEFAULT_SOURCES, ...parsed };
  } catch {
    cache = { ...DEFAULT_SOURCES };
  }
  return cache;
}

export async function isSourceActive(name: SourceName): Promise<boolean> {
  return (await getSources())[name];
}
