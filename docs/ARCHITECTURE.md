# FLOW IPTV — Arquitetura

Plataforma de streaming de **filmes, séries e dramas curtos** (experiência Netflix + ReelShort),
com identidade visual própria, tema claro (branco + azul + cinza escuro), mobile-first.

---

## 1. Stack escolhida

| Camada          | Escolha                                              | Por quê |
|-----------------|------------------------------------------------------|---------|
| Framework       | Next.js 15 (App Router) + React 19 + TypeScript      | SSR/streaming, rotas de API, deploy 1-clique na Vercel |
| Estilo          | Tailwind CSS v4 (tokens semânticos no `@theme`)      | tema claro consistente, zero CSS morto |
| Banco           | PostgreSQL (Supabase)                                | relacional (filmes/séries/episódios), RLS, auth pronta |
| Autenticação    | Supabase Auth (email/senha)                          | sessão segura + RLS por usuário |
| Dados locais    | `data/catalog/*.json` (seeds validadas com zod)      | app roda sem conta nenhuma; fallback oficial do catálogo |
| Vídeo (v1)      | Provider plugável: `local` (disco, Range) + `url` (domínio autorizado) | funciona hoje; Mux/Bunny entram na Etapa 10 sem quebrar nada |
| HLS             | `hls.js` no cliente (fallback nativo Safari)         | adaptativo quando o provider oferecer |
| Capas/metadados | TMDB (Etapa 8) — chave em env, nunca no cliente      | importação automática autorizada |
| Arquivos pequenos | GitHub API oficial (Etapa 9)                       | capas/backdrops + metadados JSON versionados |
| Hospedagem      | Vercel (app) + CDN do provedor de mídia             | edge + builds automáticos |
| Validação       | zod (fronteiras de dados externos)                   | shape inválido falha cedo, nunca vira tipo confiado |

## 2. Estrutura de pastas

```
├── src/
│   ├── app/                 # páginas e rotas (App Router)
│   │   ├── filmes/          # catálogo de filmes
│   │   ├── series/          # séries, temporadas, episódios
│   │   ├── dramas/          # dramas curtos verticais
│   │   ├── player/[kind]/   # player único (filme | serie | drama)
│   │   ├── busca/           # pesquisa
│   │   ├── admin/           # painel administrativo
│   │   └── api/media/       # streaming local com Range
│   ├── components/          # UI reutilizável (layout, cards, player)
│   ├── lib/                 # catálogo (adapters), supabase, navegação
│   ├── types/               # tipos de domínio
│   ├── validators/          # schemas zod
│   └── services/            # (Etapas 8-10) tmdb, github, media providers
├── data/catalog/            # seeds JSON + media.json (validados por zod)
├── supabase/migrations/     # SQL do banco (0001_init.sql)
├── docs/                    # esta documentação
└── public/                  # estático; public/media = vídeos locais (gitignored)
```

## 3. Camada de dados (padrão de repositório)

A aplicação conversa com a interface `CatalogAdapter` (`src/lib/catalog.ts`).
O adaptador concreto é escolhido pela env `DATA_SOURCE`:

- **`json`** (padrão): lê `data/catalog/*.json`. Sem conta, sem rede, só-leitura.
  Ideal para desenvolvimento e demonstração.
- **`supabase`**: PostgreSQL + RLS. Ativado quando `DATA_SOURCE=supabase` e as envs
  do Supabase existem. Requer `supabase/migrations/0001_init.sql`.

Regra: mudar o banco **não** muda nenhuma página — as páginas só conhecem a interface.

## 4. Fluxo de importação de capas/metadados (Etapa 8, TMDB)

```
admin informa título
  → TMDB search (chave em env)         → lista de candidatos com capas
  → admin seleciona o correto          → valida URL (https, domínio permitido)
  → download otimizado da imagem       → registra media/imports no banco
  → GitHub (Etapa 9): push p/ repo     → atualiza campo poster_url no catálogo
```
- Chaves/segredos vivem no servidor (`TMDB_API_KEY`, `GITHUB_TOKEN`).
- Nenhuma capa é inventada: sem resultado autorizado, o card mostra placeholder honesto.

## 5. Fluxo de importação de vídeos (Etapa 10)

```
admin informa arquivo local ou URL autorizada
  → valida origem/formato/tamanho (sem carregar o arquivo inteiro na memória)
  → upload direto/multipart p/ provider (local → MEDIA_ROOT; prod → Mux/Bunny)
  → registra media_files (metadados só!)  → associa a filme/série/drama
  → player reproduz via URL assinada/rotas com Range
```
- URLs externas: validação de domínio autorizado (`ALLOWED_VIDEO_DOMAINS`), sem SSRF.
- Vídeos grandes nunca vão para o GitHub nem para o banco.

## 6. Player (v1)

- MP4: `<video>` nativo; HLS (`.m3u8`): `hls.js` (fallback nativo no Safari).
- Continuação: `localStorage` agora; histórico em nuvem na Etapa 6/7.
- Vertical 9:16 nos dramas (letterbox, nunca distorce), gestos de scroll nas listas.
- Erros de rede → overlay com "tentar novamente"; fim do episódio → "próximo".

## 7. Segurança (aplicada desde a v1)

- Rotas do catálogo só leem; escrita admin sempre validada no servidor (Etapa 7).
- `server-only` nas libs de dados; chaves nunca no cliente.
- RLS no banco: público lê só publicado; escrita só service role.
- Streaming local: só arquivos registrados, sem path traversal.
- Erros claros por integração (auth/limite/permissão) nas Etapas 8-9.

## 8. Hospedagem

- **Vercel**: app Next.js (envs no dashboard, nunca no código).
- **Supabase**: banco + auth (projeto próprio).
- **Mídia**: provider plugável — dev usa disco; prod usa serviço com CDN + HLS
  (Mux ou Bunny Stream, Etapa 10). URLs assinadas quando exigir auth.

## 9. Etapas de desenvolvimento

| Etapa | Entrega | Status |
|-------|---------|--------|
| 1 | Arquitetura e planejamento | ✅ feito |
| 2 | Configuração TS/Next/Git | ✅ feito |
| 3 | UI responsiva (tema claro azul/cinza) | ✅ feito |
| 4 | Catálogo filmes/séries | ✅ feito |
| 5 | Dramas curtos verticais | ✅ feito |
| 6 | Banco + autenticação (Supabase) | 🔜 próxima |
| 7 | Painel administrativo (CRUD) | 🔜 |
| 8 | Importação TMDB (capas/metadados) | 🔜 |
| 9 | Integração GitHub (arquivos pequenos) | 🔜 |
| 10 | Armazenamento/importação de vídeos | 🔜 |
| 11 | Player avançado + HLS/CDN | 🔜 |
| 12 | Testes, segurança, otimização | 🔜 |
| 13 | Publicação e documentação | 🔜 |
