// ─────────────────────────────────────────────────────────────
// FLOW IPTV — canais de TV ao vivo (data/catalog/live.json).
// Fontes HLS públicas; o player toca direto (CORS aberto).
// ─────────────────────────────────────────────────────────────

import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

export interface LiveChannel {
  id: string;
  name: string;
  category: string;
  logo: string | null;
  src: string;
  enabled: boolean;
}

let cache: { at: number; data: LiveChannel[] } | null = null;
const CACHE_TTL_MS = 10 * 60 * 1000;

export async function listChannels(): Promise<LiveChannel[]> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.data;
  const raw = await readFile(path.join(process.cwd(), "data", "catalog", "live.json"), "utf8")
    .catch(() => "[]");
  const data = (JSON.parse(raw) as LiveChannel[]).map((c) => ({
    ...c,
    enabled: c.enabled !== false,
  }));
  cache = { at: Date.now(), data };
  return data;
}

export async function listEnabledChannels(): Promise<LiveChannel[]> {
  const all = await listChannels();
  return all.filter((c) => c.enabled);
}

export async function getChannel(id: string): Promise<LiveChannel | null> {
  const all = await listChannels();
  const channel = all.find((c) => c.id === id);
  if (!channel || !channel.enabled) return null;
  return channel;
}

export async function channelCategories(): Promise<{ category: string; count: number }[]> {
  const all = await listEnabledChannels();
  const counts = new Map<string, number>();
  for (const c of all) counts.set(c.category, (counts.get(c.category) ?? 0) + 1);
  return [...counts.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
}
