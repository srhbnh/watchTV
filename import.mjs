// ============================================================
// Import Sofa Time -> WatchNext (Supabase)
//
// Usage:
//   npm install
//   cp .env.example .env   (puis remplir les valeurs)
//   npm run import:dry-run   -> simule tout, écrit un rapport, n'écrit rien en base
//   npm run import           -> exécute réellement l'import
//
// Le script est idempotent : tu peux le relancer plusieurs fois sans
// dupliquer les données (upsert basé sur tvmaze_id / tmdb_id / imdb_id).
// ============================================================

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'node:fs/promises';

dotenv.config();

const DRY_RUN = process.argv.includes('--dry-run');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const USER_ID = process.env.WATCHNEXT_USER_ID;

if (!DRY_RUN && (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !USER_ID)) {
  console.error(
    'Variables manquantes. Remplis SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY et WATCHNEXT_USER_ID dans .env'
  );
  process.exit(1);
}

const supabase = DRY_RUN
  ? null
  : createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

// ------------------------------------------------------------
// Rate limiter simple pour l'API TVmaze (limite publique : ~20 req/10s)
// On reste prudent à 1 requête toutes les 400ms (~2.5 req/s)
// ------------------------------------------------------------
let lastCall = 0;
async function throttle() {
  const now = Date.now();
  const wait = Math.max(0, lastCall + 400 - now);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
}

async function tvmazeFetch(url, { allow404 = false } = {}) {
  await throttle();
  const res = await fetch(url);
  if (res.status === 404 && allow404) return null;
  if (res.status === 429) {
    console.warn('Rate limited par TVmaze, pause 10s...');
    await new Promise((r) => setTimeout(r, 10000));
    return tvmazeFetch(url, { allow404 });
  }
  if (!res.ok) {
    throw new Error(`TVmaze error ${res.status} for ${url}`);
  }
  return res.json();
}

async function lookupShowByImdb(imdbId) {
  if (!imdbId) return null;
  return tvmazeFetch(`https://api.tvmaze.com/lookup/shows?imdb=${imdbId}`, {
    allow404: true,
  });
}

async function searchShowByTitle(title) {
  if (!title) return null;
  const results = await tvmazeFetch(
    `https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(title)}`,
    { allow404: true }
  );
  return results;
}

async function getEpisodes(tvmazeShowId) {
  return tvmazeFetch(`https://api.tvmaze.com/shows/${tvmazeShowId}/episodes`);
}

async function resolveShow(item) {
  let match = await lookupShowByImdb(item.imdb);
  let confidence = match ? 'imdb' : null;
  if (!match) {
    match = await searchShowByTitle(item.title);
    confidence = match ? 'title-search' : null;
  }
  return { match, confidence };
}

// ------------------------------------------------------------
// Supabase helpers (upsert manuel, sans dépendre d'une contrainte
// unique particulière : on cherche d'abord, on insère/màj ensuite)
// ------------------------------------------------------------
async function findExistingMediaItem({ tvmaze_id, tmdb_id, imdb_id }) {
  if (tvmaze_id) {
    const { data } = await supabase
      .from('media_items')
      .select('id')
      .eq('tvmaze_id', tvmaze_id)
      .maybeSingle();
    if (data) return data.id;
  }
  if (tmdb_id) {
    const { data } = await supabase
      .from('media_items')
      .select('id')
      .eq('tmdb_id', tmdb_id)
      .maybeSingle();
    if (data) return data.id;
  }
  if (imdb_id) {
    const { data } = await supabase
      .from('media_items')
      .select('id')
      .eq('imdb_id', imdb_id)
      .maybeSingle();
    if (data) return data.id;
  }
  return null;
}

async function upsertMediaItem(payload) {
  const existingId = await findExistingMediaItem(payload);
  if (existingId) {
    const { error } = await supabase
      .from('media_items')
      .update(payload)
      .eq('id', existingId);
    if (error) throw error;
    return existingId;
  }
  const { data, error } = await supabase
    .from('media_items')
    .insert(payload)
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

async function upsertSeason(mediaItemId, seasonNumber) {
  const { data: existing } = await supabase
    .from('seasons')
    .select('id')
    .eq('media_item_id', mediaItemId)
    .eq('season_number', seasonNumber)
    .maybeSingle();
  if (existing) return existing.id;
  const { data, error } = await supabase
    .from('seasons')
    .insert({ media_item_id: mediaItemId, season_number: seasonNumber })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

async function upsertEpisode(seasonId, episodeNumber, tvmazeEpisode) {
  const payload = {
    season_id: seasonId,
    episode_number: episodeNumber,
    title: tvmazeEpisode?.name ?? null,
    air_date: tvmazeEpisode?.airdate || null,
    tvmaze_episode_id: tvmazeEpisode?.id ?? null,
  };
  const { data: existing } = await supabase
    .from('episodes')
    .select('id')
    .eq('season_id', seasonId)
    .eq('episode_number', episodeNumber)
    .maybeSingle();
  if (existing) {
    const { error } = await supabase
      .from('episodes')
      .update(payload)
      .eq('id', existing.id);
    if (error) throw error;
    return existing.id;
  }
  const { data, error } = await supabase
    .from('episodes')
    .insert(payload)
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

async function upsertUserMediaStatus(mediaItemId, status, addedAt) {
  const { data: existing } = await supabase
    .from('user_media_status')
    .select('id')
    .eq('user_id', USER_ID)
    .eq('media_item_id', mediaItemId)
    .maybeSingle();
  const payload = {
    user_id: USER_ID,
    media_item_id: mediaItemId,
    status,
    added_at: addedAt || new Date().toISOString(),
  };
  if (existing) {
    const { error } = await supabase
      .from('user_media_status')
      .update(payload)
      .eq('id', existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('user_media_status').insert(payload);
    if (error) throw error;
  }
}

async function upsertEpisodeProgress(episodeId, watchedAt) {
  const { data: existing } = await supabase
    .from('user_episode_progress')
    .select('id')
    .eq('user_id', USER_ID)
    .eq('episode_id', episodeId)
    .maybeSingle();
  if (existing) return; // déjà marqué vu, rien à changer
  const { error } = await supabase.from('user_episode_progress').insert({
    user_id: USER_ID,
    episode_id: episodeId,
    watched_at: watchedAt,
  });
  if (error) throw error;
}

// ------------------------------------------------------------
// Traitement d'une série
// ------------------------------------------------------------
async function processShow(item, report) {
  const { match, confidence } = await resolveShow(item);

  if (!match) {
    report.unmatched.push({ title: item.title, tmdb: item.tmdb, imdb: item.imdb });
  } else if (confidence === 'title-search') {
    report.lowConfidenceMatches.push({
      title: item.title,
      matchedTo: match.name,
      tvmaze_id: match.id,
    });
  }

  const mediaPayload = {
    tvmaze_id: match?.id ?? null,
    tmdb_id: item.tmdb ?? null,
    imdb_id: item.imdb ?? null,
    title: item.title,
    type: 'tv',
    category: item.category ?? null,
    genres: item.genres ?? [],
    runtime_minutes: item.runtime ?? match?.runtime ?? null,
    release_date: item.release_date ? item.release_date.slice(0, 10) : null,
    poster_url: match?.image?.original ?? null,
  };

  if (DRY_RUN) {
    report.wouldImport.push({ title: item.title, status: item.status, matched: !!match });
    return;
  }

  const mediaItemId = await upsertMediaItem(mediaPayload);
  await upsertUserMediaStatus(mediaItemId, item.status, item.addedDate);

  // Épisodes vus (avec dates) -> on les rattache aux épisodes TVmaze si possible
  let tvmazeEpisodes = [];
  if (match) {
    try {
      tvmazeEpisodes = await getEpisodes(match.id);
    } catch (e) {
      console.warn(`Impossible de récupérer les épisodes TVmaze pour ${item.title}: ${e.message}`);
    }
  }

  for (const season of item.seasons || []) {
    const seasonId = await upsertSeason(mediaItemId, season.number);
    for (const ep of season.episodes || []) {
      const tvmazeEp = tvmazeEpisodes.find(
        (e) => e.season === season.number && e.number === ep.number
      );
      const episodeId = await upsertEpisode(seasonId, ep.number, tvmazeEp);
      if (ep.addedDate) {
        await upsertEpisodeProgress(episodeId, ep.addedDate);
      }
    }
  }

  report.imported++;
}

// ------------------------------------------------------------
// Traitement d'un film (pas de TVmaze, pas d'épisodes)
// ------------------------------------------------------------
async function processMovie(item, report) {
  const mediaPayload = {
    tvmaze_id: null,
    tmdb_id: item.tmdb ?? null,
    imdb_id: item.imdb ?? null,
    title: item.title,
    type: 'movie',
    category: null,
    genres: item.genres ?? [],
    runtime_minutes: item.runtime ?? null,
    release_date: item.release_date ? item.release_date.slice(0, 10) : null,
    poster_url: null,
  };

  if (DRY_RUN) {
    report.wouldImport.push({ title: item.title, status: item.status, matched: true });
    return;
  }

  const mediaItemId = await upsertMediaItem(mediaPayload);
  await upsertUserMediaStatus(mediaItemId, item.status, item.addedDate);
  report.imported++;
}

// ------------------------------------------------------------
// Main
// ------------------------------------------------------------
async function main() {
  const raw = await fs.readFile(new URL('./canonical.json', import.meta.url), 'utf-8');
  const data = JSON.parse(raw);

  const report = {
    imported: 0,
    unmatched: [],
    lowConfidenceMatches: [],
    wouldImport: [],
  };

  console.log(`${DRY_RUN ? '[DRY RUN] ' : ''}Import de ${data.shows.length} séries/anime...`);
  for (const [i, show] of data.shows.entries()) {
    process.stdout.write(`\r  ${i + 1}/${data.shows.length}`);
    await processShow(show, report);
  }
  console.log('\nImport de', data.movies.length, 'films...');
  for (const [i, movie] of data.movies.entries()) {
    process.stdout.write(`\r  ${i + 1}/${data.movies.length}`);
    await processMovie(movie, report);
  }

  console.log('\n\n=== Rapport ===');
  console.log('Importés/mis à jour :', DRY_RUN ? report.wouldImport.length : report.imported);
  console.log('Non trouvés sur TVmaze :', report.unmatched.length);
  console.log('Matchés par titre (à vérifier) :', report.lowConfidenceMatches.length);

  await fs.writeFile('./import-report.json', JSON.stringify(report, null, 2), 'utf-8');
  console.log('\nRapport détaillé écrit dans import-report.json');
}

main().catch((err) => {
  console.error('Erreur fatale:', err);
  process.exit(1);
});
