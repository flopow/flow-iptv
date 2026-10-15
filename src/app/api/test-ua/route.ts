import { NextResponse } from "next/server";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

export async function GET(): Promise<Response> {
  const out: Record<string, unknown> = {};

  // AnimeUnity: testa o site e o endpoint de busca com UA de browser
  try {
    const site = await fetch("https://www.animeunity.to/", { headers: { "User-Agent": UA } });
    out.animeunity_site = site.status;
  } catch (e) {
    out.animeunity_site = e instanceof Error ? e.message : String(e);
  }
  try {
    const search = await fetch("https://www.animeunity.to/soap", { headers: { "User-Agent": UA, "X-Requested-With": "XMLHttpRequest" } });
    out.animeunity_api = search.status;
  } catch (e) {
    out.animeunity_api = e instanceof Error ? e.message : String(e);
  }

  // hianime
  try {
    const h = await fetch("https://hianime.to/home", { headers: { "User-Agent": UA } });
    out.hianime = h.status;
  } catch (e) {
    out.hianime = e instanceof Error ? e.message : String(e);
  }

  return NextResponse.json(out);
}
