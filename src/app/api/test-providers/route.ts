import { NextResponse } from "next/server";

import HianimeProvider from "@consumet/extensions/dist/providers/anime/hianime";
import AnimeUnityProvider from "@consumet/extensions/dist/providers/anime/animeunity";
import AnimePaheProvider from "@consumet/extensions/dist/providers/anime/animepahe";
import AnimeSaturnProvider from "@consumet/extensions/dist/providers/anime/animesaturn";
import AnimeKaiProvider from "@consumet/extensions/dist/providers/anime/animekai";
import KickAssProvider from "@consumet/extensions/dist/providers/anime/kickassanime";

type Searchable = { search: (q: string) => Promise<{ results?: unknown[] }> };

function asSearchable(value: unknown): Searchable | null {
  if (value && typeof value === "object" && "search" in value) {
    const search = (value as { search: unknown }).search;
    if (typeof search === "function") {
      return { search: search as Searchable["search"] };
    }
  }
  return null;
}

export async function GET(): Promise<Response> {
  const out: Record<string, unknown> = {};
  const providers: [string, unknown][] = [
    ["hianime", HianimeProvider],
    ["animeunity", AnimeUnityProvider],
    ["animepahe", AnimePaheProvider],
    ["animesaturn", AnimeSaturnProvider],
    ["animekai", AnimeKaiProvider],
    ["kickass", KickAssProvider],
  ];

  for (const [name, P] of providers) {
    try {
      const mod = P as { default?: unknown };
      const ctor = mod.default ?? P;
      const instance = typeof ctor === "function" ? new (ctor as new () => Searchable)() : null;
      const searchable = instance !== null ? asSearchable(instance) : null;
      if (!searchable) {
        out[name] = { ok: false, error: "não instanciável" };
        continue;
      }
      const res = await searchable.search("Naruto");
      out[name] = { ok: true, count: res.results?.length ?? 0 };
    } catch (err) {
      out[name] = { ok: false, error: err instanceof Error ? err.message.slice(0, 120) : String(err) };
    }
  }

  return NextResponse.json(out);
}
