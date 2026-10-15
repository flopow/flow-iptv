import type { Metadata } from "next";

import { SourceToggle } from "@/components/admin/SourceToggle";
import { getCatalog, hasSupabaseEnv } from "@/lib/catalog";
import { getSources, SOURCE_LABELS } from "@/lib/sources";

export const metadata: Metadata = { title: "Painel administrativo" };

interface EnvStatus {
  key: string;
  label: string;
  ok: boolean;
}

function StatusPill({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-flex h-2.5 w-2.5 rounded-full ${ok ? "bg-emerald-500" : "bg-amber-400"}`}
      aria-label={ok ? "configurado" : "não configurado"}
    />
  );
}

export default async function AdminPage() {
  const catalog = await getCatalog();
  const stats = await catalog.getStats();
  const source = catalog.name;
  const sources = await getSources();

  const envChecks: EnvStatus[] = [
    {
      key: "NEXT_PUBLIC_SUPABASE_URL",
      label: "Supabase (URL + chave anon)",
      ok: hasSupabaseEnv(),
    },
    { key: "TMDB_API_KEY", label: "TMDB — catálogo externo e capas", ok: Boolean(process.env.TMDB_API_KEY) },
    { key: "OMDB_API_KEY", label: "OMDb — busca extra de filmes/séries", ok: Boolean(process.env.OMDB_API_KEY) },
    { key: "GITHUB_TOKEN", label: "GitHub — repositório de mídias", ok: Boolean(process.env.GITHUB_TOKEN) },
    { key: "GITHUB_REPO", label: "GitHub — proprietário/repositório", ok: Boolean(process.env.GITHUB_REPO) },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-8 sm:px-6">
      <header className="mb-8">
        <h1 className="text-2xl font-black tracking-tight text-ink sm:text-3xl">
          Painel administrativo
        </h1>
        <p className="mt-1 text-sm text-muted">
          Gerencie o catálogo, importe capas e vídeos e acompanhe as integrações.
        </p>
      </header>

      {/* Fonte de dados */}
      <section className="rounded-2xl border border-line bg-surface p-6">
        <h2 className="text-sm font-black uppercase tracking-wide text-muted">Fonte de dados</h2>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span
            className={`rounded-full px-4 py-2 text-sm font-black ${
              source === "supabase"
                ? "bg-emerald-100 text-emerald-800"
                : "bg-accent-soft text-accent-strong"
            }`}
          >
            {source === "supabase" ? "Supabase (PostgreSQL)" : "Catálogo local (JSON)"}
          </span>
          {source === "json" ? (
            <p className="text-xs text-muted">
              Modo somente-leitura para o catálogo: define DATA_SOURCE=supabase no .env.local e
              rode a migration para ativar banco, autenticação e CRUD.
            </p>
          ) : null}
        </div>
      </section>

      {/* Estatísticas */}
      <section className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "Filmes", value: stats.publishedFilms, total: stats.films },
          { label: "Séries", value: stats.publishedSeries, total: stats.series },
          { label: "Dramas", value: stats.publishedShorts, total: stats.shorts },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-line bg-surface p-4">
            <p className="text-2xl font-black text-ink">{item.value}</p>
            <p className="text-xs font-semibold text-muted">
              {item.label} · {item.total} total
            </p>
          </div>
        ))}
      </section>

      {/* Fontes de catálogo */}
      <section className="mt-6 rounded-2xl border border-line bg-surface p-6">
        <h2 className="text-sm font-black uppercase tracking-wide text-muted">
          Fontes de catálogo
        </h2>
        <p className="mt-1 text-xs text-muted">
          Ative/desative cada fonte. A alteração é persistida e publicada (commit + deploy).
        </p>
        <ul className="mt-4 space-y-3">
          {(Object.keys(SOURCE_LABELS) as (keyof typeof SOURCE_LABELS)[]).map((name) => (
            <SourceToggle
              key={name}
              name={name}
              label={SOURCE_LABELS[name]}
              active={sources[name]}
            />
          ))}
        </ul>
      </section>

      {/* Integrações */}
      <section className="mt-6 rounded-2xl border border-line bg-surface p-6">
        <h2 className="text-sm font-black uppercase tracking-wide text-muted">
          Integrações e variáveis de ambiente
        </h2>
        <ul className="mt-4 space-y-3">
          {envChecks.map((check) => (
            <li key={check.key} className="flex items-center gap-3">
              <StatusPill ok={check.ok} />
              <div>
                <p className="text-sm font-bold text-foreground">{check.label}</p>
                <code className="text-xs text-muted">{check.key}</code>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-muted">
          Configure tudo no <code>.env.local</code> (veja <code>.env.example</code>). Chaves ficam
          apenas no servidor — nunca são expostas ao navegador.
        </p>
      </section>

      {/* Próximas etapas */}
      <section className="mt-6 rounded-2xl border border-accent-line bg-accent-soft p-6">
        <h2 className="text-sm font-black uppercase tracking-wide text-accent-strong">
          Próximas etapas de implementação
        </h2>
        <ul className="mt-3 space-y-2 text-sm text-foreground/90">
          <li>
            <strong>Etapa 6-7:</strong> banco + autenticação (Supabase) e CRUD completo de
            filmes/séries/dramas no painel.
          </li>
          <li>
            <strong>Etapa 8:</strong> importação automática de capas e metadados via TMDB.
          </li>
          <li>
            <strong>Etapa 9:</strong> integração GitHub para capas e metadados JSON.
          </li>
          <li>
            <strong>Etapa 10-11:</strong> armazenamento e importação de vídeos + HLS/CDN.
          </li>
        </ul>
      </section>
    </div>
  );
}
