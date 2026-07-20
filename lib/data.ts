import { createClient } from '@/lib/supabase/server';
import type { LibraryItem, WatchStatus } from '@/lib/types';

export interface NextUpItem {
  mediaItemId: string;
  title: string;
  category: string | null;
  posterUrl: string | null;
  seasonNumber: number;
  episodeNumber: number;
  episodeTitle: string | null;
  airDate: string | null;
  episodeId: string;
  remainingCount: number;
}

export async function getNextUp(userId: string): Promise<NextUpItem[]> {
  const supabase = createClient();

  const { data: statusRows } = await supabase
    .from('user_media_status')
    .select(
      `media_items (
         id, title, category, poster_url, type,
         seasons ( season_number, episodes ( id, episode_number, air_date, title ) )
       )`
    )
    .eq('user_id', userId)
    .in('status', ['watching', 'watched']);

  const shows = (statusRows ?? [])
    .map((r: any) => r.media_items)
    .filter((m: any) => m && m.type === 'tv' && m.seasons?.length > 0);

  if (shows.length === 0) return [];

  const { data: progressRows } = await supabase
    .from('user_episode_progress')
    .select('episode_id')
    .eq('user_id', userId);
  const watchedIds = new Set((progressRows ?? []).map((r) => r.episode_id));

  const today = new Date().toISOString().slice(0, 10);
  const result: NextUpItem[] = [];

  for (const show of shows) {
    const allEpisodes = (show.seasons as any[])
      .flatMap((s) =>
        (s.episodes ?? []).map((e: any) => ({ ...e, season_number: s.season_number }))
      )
      .sort((a, b) => a.season_number - b.season_number || a.episode_number - b.episode_number);

    const aired = allEpisodes.filter((e) => !e.air_date || e.air_date <= today);
    const nextEpisode = aired.find((e) => !watchedIds.has(e.id));
    if (!nextEpisode) continue;

    const remainingCount = aired.filter((e) => !watchedIds.has(e.id)).length;

    result.push({
      mediaItemId: show.id,
      title: show.title,
      category: show.category,
      posterUrl: show.poster_url,
      seasonNumber: nextEpisode.season_number,
      episodeNumber: nextEpisode.episode_number,
      episodeTitle: nextEpisode.title,
      airDate: nextEpisode.air_date,
      episodeId: nextEpisode.id,
      remainingCount,
    });
  }

  // Les épisodes sortis le plus récemment remontent en premier ;
  // les séries de fond de catalogue (pas de date) restent en bas.
  result.sort((a, b) => (b.airDate ?? '').localeCompare(a.airDate ?? ''));

  return result;
}

export async function getLibrary(userId: string): Promise<LibraryItem[]> {
  const supabase = createClient();

  const { data: statusRows, error } = await supabase
    .from('user_media_status')
    .select(
      `id, status, added_at,
       media_items (
         id, title, type, category, genres, runtime_minutes, release_date, poster_url, tvmaze_id,
         seasons ( id, episodes ( id ) )
       )`
    )
    .eq('user_id', userId)
    .order('added_at', { ascending: false });

  if (error) throw error;

  const { data: progressRows } = await supabase
    .from('user_episode_progress')
    .select('episode_id, episodes!inner ( season_id, seasons!inner ( media_item_id ) )')
    .eq('user_id', userId);

  const watchedCountByMedia = new Map<string, number>();
  for (const row of progressRows ?? []) {
    // @ts-expect-error -- forme imbriquée renvoyée par PostgREST
    const mediaId = row.episodes?.seasons?.media_item_id as string | undefined;
    if (!mediaId) continue;
    watchedCountByMedia.set(mediaId, (watchedCountByMedia.get(mediaId) ?? 0) + 1);
  }

  return (statusRows ?? [])
    .filter((row: any) => row.media_items)
    .map((row: any) => {
      const media = row.media_items;
      const totalEpisodes = media.seasons
        ? media.seasons.reduce((sum: number, s: any) => sum + (s.episodes?.length ?? 0), 0)
        : null;

      return {
        id: media.id,
        tvmaze_id: media.tvmaze_id,
        tmdb_id: null,
        imdb_id: null,
        title: media.title,
        type: media.type,
        category: media.category,
        genres: media.genres ?? [],
        runtime_minutes: media.runtime_minutes,
        release_date: media.release_date,
        poster_url: media.poster_url,
        status: row.status as WatchStatus,
        added_at: row.added_at,
        episodes_watched: watchedCountByMedia.get(media.id) ?? 0,
        episodes_total: media.type === 'tv' ? totalEpisodes : null,
      } satisfies LibraryItem;
    });
}
