import { createClient } from '@/lib/supabase/server';
import { getShowEpisodes, getShowWithNextEpisode } from '@/lib/tvmaze';

/**
 * Recharge les épisodes d'une série depuis TVmaze et met à jour la base :
 * nouveaux épisodes, dates de diffusion corrigées, durées, statut de la
 * série (Running / Ended / TBD). Appelée à la demande (page série, dashboard)
 * plutôt que par cron, avec un throttle sur last_synced_at pour ne pas
 * spammer l'API TVmaze.
 *
 * Le matching épisode se fait en priorité par tvmaze_episode_id (stable),
 * saison+numéro seulement en repli pour les épisodes jamais liés à TVmaze
 * (import Sofa Time non matché à l'époque). Ça évite les mélanges quand
 * TVmaze renumérote des spéciaux.
 */
export async function syncShowEpisodes(mediaItemId: string, tvmazeId: number) {
  const supabase = createClient();

  const [show, episodes] = await Promise.all([
    getShowWithNextEpisode(tvmazeId),
    getShowEpisodes(tvmazeId),
  ]);

  const { data: existingSeasons } = await supabase
    .from('seasons')
    .select('id, season_number')
    .eq('media_item_id', mediaItemId);

  const seasonIdByNumber = new Map<number, string>(
    (existingSeasons ?? []).map((s) => [s.season_number, s.id])
  );

  const seasonNumbers = Array.from(new Set(episodes.map((e) => e.season)));
  for (const seasonNumber of seasonNumbers) {
    if (seasonIdByNumber.has(seasonNumber)) continue;
    const { data, error } = await supabase
      .from('seasons')
      .insert({ media_item_id: mediaItemId, season_number: seasonNumber })
      .select('id')
      .single();
    if (error) throw error;
    seasonIdByNumber.set(seasonNumber, data.id);
  }

  // Épisodes déjà en base pour cette série, pour matcher par tvmaze_episode_id
  const seasonIds = Array.from(seasonIdByNumber.values());
  const { data: existingEpisodes } = await supabase
    .from('episodes')
    .select('id, season_id, episode_number, tvmaze_episode_id')
    .in('season_id', seasonIds.length ? seasonIds : ['00000000-0000-0000-0000-000000000000']);

  const byTvmazeId = new Map<number, { id: string }>();
  const bySeasonAndNumber = new Map<string, { id: string }>();
  for (const e of existingEpisodes ?? []) {
    if (e.tvmaze_episode_id) byTvmazeId.set(e.tvmaze_episode_id, e);
    bySeasonAndNumber.set(`${e.season_id}:${e.episode_number}`, e);
  }

  let newCount = 0;
  for (const ep of episodes) {
    const seasonId = seasonIdByNumber.get(ep.season);
    if (!seasonId) continue;

    const payload = {
      season_id: seasonId,
      episode_number: ep.number,
      title: ep.name,
      air_date: ep.airdate,
      tvmaze_episode_id: ep.id,
      runtime_minutes: ep.runtime ?? show.runtime ?? show.averageRuntime ?? null,
    };

    const match = byTvmazeId.get(ep.id) ?? bySeasonAndNumber.get(`${seasonId}:${ep.number}`);

    if (match) {
      await supabase.from('episodes').update(payload).eq('id', match.id);
    } else {
      await supabase.from('episodes').insert(payload);
      newCount++;
    }
  }

  await supabase
    .from('media_items')
    .update({
      tv_status: show.status ?? null,
      runtime_minutes: show.runtime ?? show.averageRuntime ?? null,
      poster_url: show.image?.original ?? undefined,
      last_synced_at: new Date().toISOString(),
    })
    .eq('id', mediaItemId);

  return { newCount };
}

/**
 * Synchronise plusieurs séries en parallèle (borné) — utilisé par le
 * dashboard pour rattraper les épisodes fraîchement sortis sans que
 * l'utilisateur ait à y penser. Ne resynchronise que les séries pas
 * encore synchronisées depuis STALE_HOURS, et seulement celles encore en
 * diffusion (tv_status !== 'Ended') pour ne pas taper TVmaze pour rien
 * sur les séries terminées.
 */
export async function syncStaleShows(
  shows: { mediaItemId: string; tvmazeId: number; lastSyncedAt: string | null; tvStatus: string | null }[],
  { staleHours = 6, maxConcurrent = 8 }: { staleHours?: number; maxConcurrent?: number } = {}
) {
  const cutoff = Date.now() - staleHours * 3600 * 1000;
  const toSync = shows.filter((s) => {
    if (s.tvStatus === 'Ended') return false; // terminée : pas de nouvel épisode possible
    if (!s.lastSyncedAt) return true;
    return new Date(s.lastSyncedAt).getTime() < cutoff;
  });

  const queue = [...toSync];
  let syncedAny = false;

  async function worker() {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) return;
      try {
        await syncShowEpisodes(item.mediaItemId, item.tvmazeId);
        syncedAny = true;
      } catch {
        // une série en échec de sync ne doit pas bloquer les autres
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(maxConcurrent, toSync.length) }, worker));
  return { syncedCount: toSync.length, syncedAny };
}
