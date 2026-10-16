// ─────────────────────────────────────────────────────────────
// FLOW IPTV — canais de TV ao vivo.
// Catálogo embutido via import (funciona no Vercel e no
// Cloudflare Workers, onde não há filesystem com data/).
// ─────────────────────────────────────────────────────────────

import "server-only";

import liveCatalog from "../../data/catalog/live.json";

export interface LiveChannel {
  id: string;
  name: string;
  category: string;
  logo: string | null;
  src: string;
  enabled: boolean;
}

const CHANNELS: LiveChannel[] = (liveCatalog as LiveChannel[]).map((c) => ({
  ...c,
  enabled: c.enabled !== false,
}));

export async function listChannels(): Promise<LiveChannel[]> {
  return CHANNELS;
}

export async function listEnabledChannels(): Promise<LiveChannel[]> {
  return CHANNELS.filter((c) => c.enabled);
}

export async function getChannel(id: string): Promise<LiveChannel | null> {
  const channel = CHANNELS.find((c) => c.id === id);
  if (!channel || !channel.enabled) return null;
  return channel;
}

export async function channelCategories(): Promise<{ category: string; count: number }[]> {
  const counts = new Map<string, number>();
  for (const c of CHANNELS) {
    if (!c.enabled) continue;
    counts.set(c.category, (counts.get(c.category) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
}
