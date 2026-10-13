-- ─────────────────────────────────────────────────────────────
-- FLOW IPTV — esquema inicial (PostgreSQL / Supabase)
--
-- Como aplicar (Supabase):
--   1. Crie o projeto em supabase.com
--   2. SQL Editor → cole e execute este arquivo
--   3. Preencha .env.local (veja .env.example)
--
-- Regras gerais:
--   - Vídeos NUNCA no banco: só metadados + referência (media_files)
--   - Leitura pública: apenas itens status='published'
--   - Escrita: somente service role (servidor) via RLS
-- ─────────────────────────────────────────────────────────────

-- Extensão de UUID
create extension if not exists "pgcrypto";

-- ── Usuários / perfis ─────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  role text not null default 'user'
    check (role in ('user', 'editor', 'admin')),
  created_at timestamptz not null default now()
);

-- ── Arquivos de mídia (metadados + referência) ───────────────
create table public.media_files (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('local', 'url', 'mux')),
  format text not null check (format in ('mp4', 'mkv', 'hls', 'webm')),
  src text not null, -- caminho local, URL autorizada ou playback id
  size_bytes bigint,
  duration_seconds int,
  created_at timestamptz not null default now()
);

-- ── Filmes ───────────────────────────────────────────────────
create table public.films (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  synopsis text not null default '',
  poster_url text,
  backdrop_url text,
  year int,
  genres text[] not null default '{}',
  duration_minutes int,
  age_rating text check (age_rating in ('L', '10', '12', '14', '16', '18')),
  language text,
  subtitles text[] not null default '{}',
  media_file_id uuid references public.media_files (id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'published')),
  featured boolean not null default false,
  created_at timestamptz not null default now()
);

create index films_status_idx on public.films (status);
create index films_genres_idx on public.films using gin (genres);

-- ── Séries ───────────────────────────────────────────────────
create table public.series (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  synopsis text not null default '',
  poster_url text,
  backdrop_url text,
  year int,
  genres text[] not null default '{}',
  age_rating text check (age_rating in ('L', '10', '12', '14', '16', '18')),
  language text,
  subtitles text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'published')),
  featured boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null references public.series (id) on delete cascade,
  number int not null,
  title text not null default '',
  unique (series_id, number)
);

create table public.episodes (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons (id) on delete cascade,
  number int not null,
  title text not null,
  synopsis text,
  duration_minutes int,
  thumb_url text,
  media_file_id uuid references public.media_files (id) on delete set null,
  unique (season_id, number)
);

-- ── Dramas curtos (verticais) ────────────────────────────────
create table public.short_dramas (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  synopsis text not null default '',
  poster_url text,
  backdrop_url text,
  year int,
  genres text[] not null default '{}',
  age_rating text check (age_rating in ('L', '10', '12', '14', '16', '18')),
  language text,
  status text not null default 'draft' check (status in ('draft', 'published')),
  featured boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.short_episodes (
  id uuid primary key default gen_random_uuid(),
  short_id uuid not null references public.short_dramas (id) on delete cascade,
  number int not null,
  title text not null,
  duration_seconds int,
  thumb_url text,
  media_file_id uuid references public.media_files (id) on delete set null,
  unique (short_id, number)
);

-- ── Histórico e favoritos ────────────────────────────────────
create table public.playback_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  item_type text not null check (item_type in ('film', 'series', 'short')),
  item_id uuid not null,
  position_seconds int not null default 0,
  updated_at timestamptz not null default now(),
  unique (user_id, item_type, item_id)
);

create table public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  item_type text not null check (item_type in ('film', 'series', 'short')),
  item_id uuid not null,
  created_at timestamptz not null default now(),
  unique (user_id, item_type, item_id)
);

-- ── Importações e auditoria ──────────────────────────────────
create table public.imports (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('poster', 'metadata', 'video', 'github')),
  source text not null,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'success', 'failed')),
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references auth.users (id) on delete set null,
  action text not null,
  target text not null default '',
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table public.settings (
  key text primary key,
  value jsonb not null
);

-- ── RLS ──────────────────────────────────────────────────────
alter table public.media_files enable row level security;
alter table public.films enable row level security;
alter table public.series enable row level security;
alter table public.seasons enable row level security;
alter table public.episodes enable row level security;
alter table public.short_dramas enable row level security;
alter table public.short_episodes enable row level security;
alter table public.playback_history enable row level security;
alter table public.favorites enable row level security;
alter table public.imports enable row level security;
alter table public.admin_audit_log enable row level security;
alter table public.settings enable row level security;

-- Leitura pública: apenas conteúdo publicado
create policy "leitura publica de filmes publicados"
  on public.films for select using (status = 'published');
create policy "leitura publica de series publicadas"
  on public.series for select using (status = 'published');
create policy "leitura publica de episodios"
  on public.episodes for select
  using (exists (
    select 1 from public.seasons s
    join public.series se on se.id = s.series_id
    where s.id = episodes.season_id and se.status = 'published'
  ));
create policy "leitura publica de temporadas"
  on public.seasons for select
  using (exists (
    select 1 from public.series se where se.id = seasons.series_id and se.status = 'published'
  ));
create policy "leitura publica de dramas publicados"
  on public.short_dramas for select using (status = 'published');
create policy "leitura publica de episodios de drama"
  on public.short_episodes for select
  using (exists (
    select 1 from public.short_dramas sd
    where sd.id = short_episodes.short_id and sd.status = 'published'
  ));
create policy "leitura publica de midia de conteudo publicado"
  on public.media_files for select
  using (exists (
    select 1 from public.films f where f.media_file_id = media_files.id and f.status = 'published'
    union all
    select 1 from public.episodes e where e.media_file_id = media_files.id
    union all
    select 1 from public.short_episodes se where se.media_file_id = media_files.id
  ));

-- Histórico/favoritos: dono lê e escreve o próprio
create policy "historico do proprio usuario"
  on public.playback_history for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "favoritos do proprio usuario"
  on public.favorites for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Escrita: apenas service role (nenhum papel autenticado comum)
create policy "sem escrita publica em midia"
  on public.media_files for all using (false) with check (false);
create policy "sem escrita publica em filmes"
  on public.films for all using (false) with check (false);
create policy "sem escrita publica em series"
  on public.series for all using (false) with check (false);
create policy "sem escrita publica em temporadas"
  on public.seasons for all using (false) with check (false);
create policy "sem escrita publica em episodios"
  on public.episodes for all using (false) with check (false);
create policy "sem escrita publica em dramas"
  on public.short_dramas for all using (false) with check (false);
create policy "sem escrita publica em episodios de drama"
  on public.short_episodes for all using (false) with check (false);
create policy "sem escrita publica em imports"
  on public.imports for all using (false) with check (false);
create policy "sem escrita publica em auditoria"
  on public.admin_audit_log for all using (false) with check (false);
create policy "sem escrita publica em settings"
  on public.settings for all using (false) with check (false);

-- Perfil do usuário
create policy "leitura do proprio perfil"
  on public.profiles for select using (auth.uid() = id);
create policy "escrita do proprio perfil"
  on public.profiles for insert with check (auth.uid() = id);
