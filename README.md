# FLOW IPTV

Plataforma web de **filmes, séries e dramas curtos** — experiência de navegação inspirada em
Netflix e ReelShort, com identidade visual própria. Tema claro: fundo branco, detalhes azuis,
texto em cinza escuro. Mobile-first (Android, iPhone, tablet, desktop).

> Status atual: **Etapas 1–5 concluídas** — arquitetura, scaffold, UI responsiva, catálogo de
> filmes/séries e dramas curtos verticais, player com HLS e continuação. Próxima: banco +
> autenticação (Etapa 6). Veja `docs/ARCHITECTURE.md`.

---

## Stack

- **Next.js 15** (App Router) + **React 19** + **TypeScript** (strict)
- **Tailwind CSS v4** (tokens semânticos no `@theme`)
- **Supabase** (PostgreSQL + Auth + RLS) — opcional, ativado por env
- **hls.js** para HLS; `<video>` nativo para MP4
- **zod** para validação nas fronteiras de dados externos
- Vídeos por **provider plugável** (`local` agora; Mux/Bunny na Etapa 10)

## Começando

Pré-requisito: Node.js 20+ (projeto testado com Node 24).

```bash
npm install
cp .env.example .env.local   # DATA_SOURCE=json já vem pronto no .env.local
npm run dev                  # http://localhost:3000
```

Sem conta nenhuma o app já roda: o catálogo vem de `data/catalog/*.json`
(seeds validados com zod, somente-leitura). Os seeds de vídeo usam streams públicos
de teste **claramente identificados como demo** — troque por conteúdo autorizado.

## Scripts

| Comando           | O que faz                          |
|-------------------|------------------------------------|
| `npm run dev`     | servidor de desenvolvimento        |
| `npm run build`   | build de produção                  |
| `npm start`       | serve o build (produção)           |
| `npm run typecheck` | checagem de tipos (tsc --noEmit) |
| `npm run lint`    | ESLint                             |

## Estrutura

```
src/app/                páginas: filmes, series, dramas, player, busca, admin, api/media
src/components/         UI reutilizável (Header, PosterCard, Row, Player, ícones)
src/lib/                catálogo (adapters json/supabase), cliente Supabase, navegação
src/types/              tipos de domínio
src/validators/         schemas zod do catálogo
data/catalog/           seeds JSON (films, series, shorts, media)
supabase/migrations/    esquema PostgreSQL (0001_init.sql)
docs/ARCHITECTURE.md    arquitetura completa
```

## Configurando o Supabase (Etapa 6 — banco + auth)

1. Crie o projeto em https://supabase.com.
2. SQL Editor → cole e execute `supabase/migrations/0001_init.sql`.
3. Preencha no `.env.local`:

```env
DATA_SOURCE=supabase
NEXT_PUBLIC_SUPABASE_URL=...        # Project Settings → API
NEXT_PUBLIC_SUPABASE_ANON_KEY=...   # chave anon (pública)
# SUPABASE_SERVICE_ROLE_KEY=...     # APENAS no servidor, para o painel
```

Com `DATA_SOURCE=supabase` o catálogo passa a ser lido do banco (RLS: só conteúdo
publicado aparece publicamente).

## Capas e metadados (Etapa 8 — TMDB)

Importação automática de capas/sinopses via TMDB. Para habilitar depois:

```env
TMDB_API_KEY=...       # https://www.themoviedb.org/settings/api
TMDB_LANGUAGE=pt-BR
```

## GitHub (Etapa 9 — arquivos pequenos)

Capas, backdrops e metadados JSON vão para um repositório autorizado via API oficial:

```env
GITHUB_TOKEN=...       # escopo mínimo "repo"
GITHUB_REPO=usuario/repo
GITHUB_BRANCH=main
GITHUB_MEDIA_PATH=public
```

> O GitHub **não** é servidor de vídeo. Vídeos grandes ficam no provider de mídia.

## Importação de dramas (site autorizado → GitHub → site)

Fluxo automatizado: lista os dramas, baixa capas/sinopses, re-empacota cada
episódio de HLS para MP4 (`ffmpeg -c copy`, sem re-encode) e sobe tudo para o
repositório de mídia no GitHub (dedupe por SHA). O catálogo passa a apontar
para `raw.githubusercontent.com` — o site exibe capas e toca os episódios
direto de lá.

```bash
gh auth login                       # uma vez
FFMPEG=C:/caminho/ffmpeg.exe node scripts/import-dramasite.mjs --limit 5
FFMPEG=C:/caminho/ffmpeg.exe node scripts/import-dramasite.mjs --drama <slug> --max-episodes 3
```

Limites: arquivos > 100 MB não sobem (limite do GitHub) — ficam com a URL
externa original e o log avisa. Para crescer além disso, troque para
`MEDIA_PROVIDER=r2` (Cloudflare R2: 10 GB grátis, egress zero).

## Mídia local (desenvolvimento)

Coloque vídeos em `public/media/` (ou defina `MEDIA_ROOT`), registre um `MediaFile` no
catálogo com `provider: "local"` e associe-o ao título. O player reproduz via
`/api/media/<id>` com suporte a **Range** (seek/scrub e retomada funcionam).

## Segurança

- Chaves e tokens vivem apenas em variáveis de ambiente (nunca no código/cliente).
- `server-only` nas bibliotecas de dados; RLS no banco.
- Streaming local só serve arquivos registrados (sem path traversal).
- URLs de vídeo externo passam por validação de domínio autorizado na importação.

## Publicação (Vercel)

1. Suba o repositório para o GitHub.
2. Importe na Vercel (framework detectado: Next.js).
3. Configure as envs no dashboard da Vercel (as mesmas do `.env.local`).
4. Deploy automático a cada push.

## Roadmap

Veja a tabela de etapas em `docs/ARCHITECTURE.md`. Próximas entregas, em ordem:
banco + autenticação (6) → painel CRUD (7) → importação TMDB (8) → GitHub (9) →
armazenamento de vídeos + HLS/CDN (10-11) → testes/segurança/otimização (12) →
publicação (13).
