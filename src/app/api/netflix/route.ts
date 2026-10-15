import { NextResponse } from "next/server";

import { getNetflixCatalog, hasNetflixKey } from "@/lib/netflix";

// Catálogo Netflix (metadados via uNoGS) para o cliente.
// Cache: 6h em memória + revalidate no fetch. Erro gracioso se sem chave.
export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 100);

  if (!hasNetflixKey()) {
    return NextResponse.json(
      { error: "NETFLIX_RAPIDAPI_KEY não configurada", items: [] },
      { status: 503 },
    );
  }

  try {
    const items = await getNetflixCatalog(limit);
    return NextResponse.json(
      { items, fetchedAt: new Date().toISOString() },
      { headers: { "cache-control": "public, max-age=21600, stale-while-revalidate=86400" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "erro";
    return NextResponse.json({ error: message, items: [] }, { status: 502 });
  }
}
