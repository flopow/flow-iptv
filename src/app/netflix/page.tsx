import type { Metadata } from "next";

import { PosterCard } from "@/components/ui/PosterCard";
import { getNetflixCatalog, hasNetflixKey } from "@/lib/netflix";
import type { NetflixTitle } from "@/lib/netflix";

export const metadata: Metadata = { title: "Catálogo Netflix" };

export const revalidate = 21600; // 6h

export default async function NetflixPage() {
  if (!hasNetflixKey()) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-24 text-center sm:px-6">
        <h1 className="text-2xl font-bold text-ink">Catálogo Netflix</h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-muted">
          A chave da API (uNoGS) ainda não foi configurada. Defina
          <code className="mx-1 rounded bg-surface px-1.5 py-0.5 text-xs">NETFLIX_RAPIDAPI_KEY</code>
          no ambiente do deploy.
        </p>
      </div>
    );
  }

  let items: NetflixTitle[] = [];
  let error: string | null = null;
  try {
    items = await getNetflixCatalog(50);
  } catch (err) {
    error = err instanceof Error ? err.message : "erro ao buscar catálogo";
  }

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">Catálogo Netflix</h1>
        <p className="mt-2 text-sm text-muted">
          Títulos disponíveis na Netflix (metadados via uNoGS). Reprodução apenas na Netflix oficial.
        </p>
      </header>

      {error ? (
        <div className="rounded-2xl border border-line bg-surface py-20 text-center">
          <p className="text-sm text-muted">{error}</p>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface py-20 text-center">
          <p className="text-sm text-muted">Nenhum título retornado pela API.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {items.map((item) => (
            <PosterCard
              key={item.id}
              href={`/netflix/${encodeURIComponent(item.id)}`}
              title={item.title}
              posterUrl={item.posterUrl}
              badge={item.type === "film" ? "Filme" : "Série"}
              subtitle={[item.year, item.genres[0]].filter(Boolean).join(" · ")}
            />
          ))}
        </div>
      )}
    </div>
  );
}
