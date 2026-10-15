-- FLOW IPTV — esquema D1 (SQLite / Cloudflare)
-- Vídeos NUNCA no banco: só metadados + referência (media_files).
-- Aplicar: wrangler d1 execute flow-iptv-db --file=supabase/d1_schema.sql

create table media_files (
  id text primary key,
  provider text not null check (provider in ('local', 'url', 'mux', 'drive')),
  format text not null check (format in ('mp4', 'mkv', 'hls', 'webm')),
  src text not null,
  size_bytes integer,
  duration_seconds integer,
  created_at text not null
);

create table films (
  id text primary key,
  title text not null,
  synopsis text not null default '',
  poster_url text,
  backdrop_url text,
  year integer,
  genres text not null default '[]',
  duration_minutes integer,
  age_rating text,
  language text,
  subtitles text not null default '[]',
  media_file_id text,
  status text not null default 'draft',
  featured integer not null default 0,
  created_at text not null
);

create table series (
  id text primary key,
  title text not null,
  synopsis text not null default '',
  poster_url text,
  backdrop_url text,
  year integer,
  genres text not null default '[]',
  age_rating text,
  language text,
  subtitles text not null default '[]',
  status text not null default 'draft',
  featured integer not null default 0,
  created_at text not null
);

create table seasons (
  id text primary key,
  series_id text not null,
  number integer not null,
  title text not null default '',
  foreign key (series_id) references series (id) on delete cascade
);

create table episodes (
  id text primary key,
  season_id text not null,
  number integer not null,
  title text not null,
  synopsis text,
  duration_minutes integer,
  thumb_url text,
  media_file_id text,
  foreign key (season_id) references seasons (id) on delete cascade
);

create table short_dramas (
  id text primary key,
  title text not null,
  synopsis text not null default '',
  poster_url text,
  backdrop_url text,
  year integer,
  genres text not null default '[]',
  age_rating text,
  language text,
  status text not null default 'draft',
  featured integer not null default 0,
  created_at text not null
);

create table short_episodes (
  id text primary key,
  drama_id text not null,
  number integer not null,
  title text not null,
  duration_seconds integer,
  thumb_url text,
  media_file_id text,
  foreign key (drama_id) references short_dramas (id) on delete cascade
);

create index episodes_season_idx on episodes (season_id);
create index short_episodes_drama_idx on short_episodes (drama_id);
create index series_status_idx on series (status);
create index films_status_idx on films (status);
create index short_dramas_status_idx on short_dramas (status);
