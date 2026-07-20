-- ============================================================
-- WatchNext — Proposition de schéma Supabase (PostgreSQL)
-- Pensé pour coller aux données de l'export Sofa Time / TV Time
-- et à un usage mono ou multi-utilisateur (RLS activé)
-- ============================================================

-- Extensions utiles
create extension if not exists "uuid-ossp";

-- ------------------------------------------------------------
-- ENUMS
-- ------------------------------------------------------------
create type media_type as enum ('tv', 'movie');
create type media_category as enum ('anime', 'serie');
create type watch_status as enum ('watching', 'watched', 'watchlist', 'dropped');

-- ------------------------------------------------------------
-- MEDIA_ITEMS : un show ou un film, partagé entre tous les users
-- (référentiel unique, indépendant de qui l'a vu)
-- ------------------------------------------------------------
create table media_items (
  id uuid primary key default uuid_generate_v4(),
  tvmaze_id integer unique,           -- id TVmaze, source principale pour les séries
  tmdb_id integer,                    -- id TMDB (venant de Sofa Time), utile pour les films
  imdb_id text,                       -- id IMDB, le plus fiable pour le matching
  title text not null,
  type media_type not null,
  category media_category,            -- null pour les films
  genres text[] default '{}',
  runtime_minutes integer,
  release_date date,
  poster_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_media_items_tmdb on media_items (tmdb_id);
create index idx_media_items_imdb on media_items (imdb_id);
create index idx_media_items_tvmaze on media_items (tvmaze_id);

-- ------------------------------------------------------------
-- SEASONS / EPISODES : structure des séries (pas pour les films)
-- ------------------------------------------------------------
create table seasons (
  id uuid primary key default uuid_generate_v4(),
  media_item_id uuid not null references media_items(id) on delete cascade,
  season_number integer not null,
  tvmaze_season_id integer,
  unique (media_item_id, season_number)
);

create table episodes (
  id uuid primary key default uuid_generate_v4(),
  season_id uuid not null references seasons(id) on delete cascade,
  episode_number integer not null,
  title text,
  air_date date,
  tvmaze_episode_id integer,
  unique (season_id, episode_number)
);

create index idx_episodes_season on episodes (season_id);

-- ------------------------------------------------------------
-- USER_MEDIA_STATUS : le statut d'un user vis-à-vis d'un média
-- (vu, en cours, watchlist, abandonné)
-- ------------------------------------------------------------
create table user_media_status (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  media_item_id uuid not null references media_items(id) on delete cascade,
  status watch_status not null,
  added_at timestamptz not null default now(),   -- correspond à addedDate de Sofa Time
  updated_at timestamptz not null default now(),
  unique (user_id, media_item_id)
);

create index idx_ums_user on user_media_status (user_id);
create index idx_ums_status on user_media_status (user_id, status);

-- ------------------------------------------------------------
-- USER_EPISODE_PROGRESS : quels épisodes précis ont été vus, et quand
-- ------------------------------------------------------------
create table user_episode_progress (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  episode_id uuid not null references episodes(id) on delete cascade,
  watched_at timestamptz not null,   -- correspond à l'addedDate de l'épisode dans Sofa Time
  unique (user_id, episode_id)
);

create index idx_uep_user on user_episode_progress (user_id);
create index idx_uep_episode on user_episode_progress (episode_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table media_items enable row level security;
alter table seasons enable row level security;
alter table episodes enable row level security;
alter table user_media_status enable row level security;
alter table user_episode_progress enable row level security;

-- Le référentiel média (media_items, seasons, episodes) est en lecture
-- libre pour tout utilisateur connecté, mais non modifiable directement
-- (c'est ton backend / script d'import qui écrit dedans avec la service role key)
create policy "media_items readable by authenticated"
  on media_items for select
  using (auth.role() = 'authenticated');

create policy "seasons readable by authenticated"
  on seasons for select
  using (auth.role() = 'authenticated');

create policy "episodes readable by authenticated"
  on episodes for select
  using (auth.role() = 'authenticated');

-- Chacun ne voit / modifie que ses propres statuts et sa progression
create policy "user sees own media status"
  on user_media_status for select
  using (auth.uid() = user_id);

create policy "user manages own media status"
  on user_media_status for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user sees own episode progress"
  on user_episode_progress for select
  using (auth.uid() = user_id);

create policy "user manages own episode progress"
  on user_episode_progress for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- Notes de conception
-- ============================================================
-- 1. media_items est un référentiel PARTAGÉ : si un jour tu as plusieurs
--    utilisateurs, une même série n'est stockée qu'une fois, et chacun a
--    sa propre ligne dans user_media_status / user_episode_progress.
-- 2. tvmaze_id est la clé "de vérité" pour matcher avec l'API TVmaze déjà
--    utilisée par WatchNext (retry logic existante). tmdb_id/imdb_id sont
--    gardés comme identifiants d'origine issus de Sofa Time, pour retrouver
--    la source et pour le matching initial.
-- 3. Les films n'ont pas de seasons/episodes : leur statut suffit dans
--    user_media_status (watched_at approximé par added_at si besoin).
-- 4. Le script d'import (à écrire une fois ce schéma validé) devra :
--    a. Résoudre tvmaze_id via /lookup/shows?imdb=... pour chaque série
--    b. Insérer media_items / seasons / episodes (idempotent, upsert par tvmaze_id)
--    c. Insérer user_media_status + user_episode_progress pour ton user_id
