import { createClient } from '@/lib/supabase/server';
import type { LibraryItem, WatchStatus } from '@/lib/types';

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
