// ─────────────────────────────────────────────────────────────
// FLOW IPTV — validadores do catálogo (zod)
//
// Usados na fronteira de dados externos: seeds JSON (adaptador json),
// e serão reutilizados na importação TMDB e nas rotas do painel.
// Um shape inválido falha com mensagem clara, nunca vira shape
// "confiado" silenciosamente.
// ─────────────────────────────────────────────────────────────

import { z } from "zod";

const statusSchema = z.enum(["draft", "published"]);
const ageRatingSchema = z.enum(["L", "10", "12", "14", "16", "18"]).nullable();
const nullableUrl = z.string().url().nullable();

export const mediaFileSchema = z.array(
  z.object({
    id: z.string().min(1),
    provider: z.enum(["local", "url", "mux", "drive"]),
    format: z.enum(["mp4", "mkv", "hls", "webm"]),
    src: z.string().min(1),
    sizeBytes: z.number().int().nonnegative().nullable(),
    durationSeconds: z.number().int().nonnegative().nullable(),
    createdAt: z.string(),
  }),
);

const filmBaseSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  synopsis: z.string(),
  posterUrl: nullableUrl,
  backdropUrl: nullableUrl,
  year: z.number().int().nullable(),
  genres: z.array(z.string()),
  durationMinutes: z.number().int().nonnegative().nullable(),
  ageRating: ageRatingSchema,
  language: z.string().nullable(),
  subtitles: z.array(z.string()),
  mediaFileId: z.string().nullable(),
  status: statusSchema,
  featured: z.boolean(),
  createdAt: z.string(),
});

export const filmSchema = z.array(filmBaseSchema);

const episodeSchema = z.object({
  id: z.string().min(1),
  number: z.number().int().nonnegative(),
  title: z.string().min(1),
  synopsis: z.string().nullable(),
  durationMinutes: z.number().int().nonnegative().nullable(),
  thumbUrl: nullableUrl,
  mediaFileId: z.string().nullable(),
  subtitleUrl: nullableUrl.optional(),
});

const seasonSchema = z.object({
  id: z.string().min(1),
  number: z.number().int().nonnegative(),
  title: z.string(),
  episodes: z.array(episodeSchema),
});

const seriesBaseSchema = filmBaseSchema
  .omit({ durationMinutes: true, mediaFileId: true })
  .extend({ seasons: z.array(seasonSchema) });
export const seriesSchema = z.array(seriesBaseSchema);

const shortEpisodeSchema = z.object({
  id: z.string().min(1),
  number: z.number().int().nonnegative(),
  title: z.string().min(1),
  durationSeconds: z.number().int().nonnegative().nullable(),
  thumbUrl: nullableUrl,
  mediaFileId: z.string().nullable(),
  subtitleUrl: nullableUrl.optional(),
});

const shortBaseSchema = filmBaseSchema
  .omit({ durationMinutes: true, subtitles: true, mediaFileId: true })
  .extend({ episodes: z.array(shortEpisodeSchema) });
export const shortDramaSchema = z.array(shortBaseSchema);
