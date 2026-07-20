import { createClient } from '@/lib/supabase/server';
import type { LibraryItem, WatchStatus } from '@/lib/types';

export interface ToWatchItem {
  mediaItemId: string;
  title: string;
  category: string | null;
  posterUrl: string | null;
  seasonNumber: number;
  episodeNumber: number;
  episodeTitle: string | null;
  episodeId: string;
  airDate: string | null;
  remainingCount: number;
  runtimeMinutes: number | null;
}

export interface UpcomingEpisodeItem {
  mediaItemId: string;
  title: string;
  category: string | null;
  posterUrl: string | null;
  seasonNumber: number;
  episodeNumber: number;
  episodeTitle: string | null;
  airDate: string;
}

export interface DashboardData {
  toWatch: ToWatchItem[];
  upcoming: UpcomingEpisodeItem[];
}

/**
 * Construit le dashboard "à voir" à partir de la base locale (déjà synchronisée
 * avec TVmaze en amont, voir lib/sync.ts). Deux blocs :
 *  - toWatch : le prochain épisode sorti et pas encore vu, pour chaque série
 *    suivie (watching ou watched — une série "watched" peut très bien avoir
 *    un épisode tout frais qu'on n'a pas encore vu). Triés par date de
 *    sortie décroissante : ce qui vient de sortir remonte en haut.
 *  - upcoming : épisodes annoncés mais pas encore sortis, avec leur date.
 *
 * Les séries dont tv_status === 'Ended' sont incluses normalement : "Ended"
 * veut juste dire qu'aucun nouvel épisode n'est prévu, ça n'empêche pas
 * d'avoir un backlog à rattraper (ex : reprendre une série finie à la
 * saison 5 épisode 20).
 */
export async function getDashboard(userId: string): Promise<DashboardData> {
  const supabase = createClient();

  const { data: statusRows } = await supabase
    .from('user_media_status')
    .select(
      `media_items (
         id, title, category, poster_url, type, tv_status,
         seasons ( season_number, episodes ( id, episode_number, air_date, title, runtime_minutes ) )
       )`
    )
    .eq('user_id', userId)
    .in('status', ['watching', 'watched']);

  const shows = (statusRows ?? [])
    .map((r: any) => r.media_items)
    .filter((m: any) => m && m.type === 'tv' && m.seasons?.length > 0);

  if (shows.length === 0) return { toWatch: [], upcoming: [] };

  const { data: progressRows } = await supabase
    .from('user_episode_progress')
    .select('episode_id')
    .eq('user_id', userId);
  const watchedIds = new Set((progressRows ?? []).map((r) => r.episode_id));

  const now = new Date().toISOString();
  const toWatch: ToWatchItem[] = [];
  const upcoming: UpcomingEpisodeItem[] = [];

  for (const show of shows) {
    const allEpisodes = (show.seasons as any[])
      .flatMap((s) =>
        (s.episodes ?? []).map((e: any) => ({ ...e, season_number: s.season_number }))
      )
      .sort((a, b) => a.season_number - b.season_number || a.episode_number - b.episode_number);

    const aired = allEpisodes.filter((e) => e.air_date && `${e.air_date}T23:59:59` <= now);
    const unwatchedAired = aired.filter((e) => !watchedIds.has(e.id));

    if (unwatchedAired.length > 0) {
      const next = unwatchedAired[0];
      toWatch.push({
        mediaItemId: show.id,
        title: show.title,
        category: show.category,
        posterUrl: show.poster_url,
        seasonNumber: next.season_number,
        episodeNumber: next.episode_number,
        episodeTitle: next.title,
        episodeId: next.id,
        airDate: next.air_date,
        remainingCount: unwatchedAired.length,
        runtimeMinutes: next.runtime_minutes,
      });
    }

    const notYetAired = allEpisodes.filter((e) => e.air_date && `${e.air_date}T23:59:59` > now);
    for (const e of notYetAired.slice(0, 1)) {
      upcoming.push({
        mediaItemId: show.id,
        title: show.title,
        category: show.category,
        posterUrl: show.poster_url,
        seasonNumber: e.season_number,
        episodeNumber: e.episode_number,
        episodeTitle: e.title,
        airDate: e.air_date,
      });
    }
  }

  toWatch.sort((a, b) => (b.airDate ?? '').localeCompare(a.airDate ?? ''));
  upcoming.sort((a, b) => a.airDate.localeCompare(b.airDate));

  return { toWatch, upcoming };
}

export async function getLibrary(userId: string): Promise<LibraryItem[]> {
  const supabase = createClient();

  const { data: statusRows, error } = await supabase
    .from('user_media_status')
    .select(
      `id, status, added_at,
       media_items (
         id, title, type, category, genres, runtime_minutes, release_date, poster_url,
         tvmaze_id, tmdb_id, imdb_id, tv_status, last_synced_at,
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
        tmdb_id: media.tmdb_id,
        imdb_id: media.imdb_id,
        title: media.title,
        type: media.type,
        category: media.category,
        genres: media.genres ?? [],
        runtime_minutes: media.runtime_minutes,
        release_date: media.release_date,
        poster_url: media.poster_url,
        tv_status: media.tv_status,
        last_synced_at: media.last_synced_at,
        status: row.status as WatchStatus,
        added_at: row.added_at,
        episodes_watched: watchedCountByMedia.get(media.id) ?? 0,
        episodes_total: media.type === 'tv' ? totalEpisodes : null,
      } satisfies LibraryItem;
    });
}

export interface StatusMismatch {
  mediaItemId: string;
  title: string;
  currentStatus: WatchStatus;
  suggestedStatus: WatchStatus;
  episodesWatched: number;
  episodesTotal: number;
}

/**
 * Détecte les séries dont le statut ne colle pas au nombre d'épisodes
 * réellement vus (ex: marquée "Vu" alors que 0 épisode coché — typiquement
 * un reliquat de l'import Sofa Time). Ne touche jamais "dropped" — c'est
 * un choix explicite de l'utilisateur, pas une déduction.
 */
export async function getStatusMismatches(userId: string): Promise<StatusMismatch[]> {
  const items = await getLibrary(userId);
  const mismatches: StatusMismatch[] = [];

  for (const item of items) {
    if (item.type !== 'tv' || item.status === 'dropped') continue;
    const total = item.episodes_total ?? 0;
    if (total === 0) continue;
    const watched = item.episodes_watched;

    let suggested: WatchStatus | null = null;
    if (item.status === 'watched' && watched === 0) suggested = 'watchlist';
    else if (item.status === 'watched' && watched < total) suggested = 'watching';
    else if (item.status === 'watchlist' && watched > 0 && watched < total) suggested = 'watching';
    else if (item.status === 'watchlist' && watched >= total) suggested = 'watched';
    else if (item.status === 'watching' && watched >= total) suggested = 'watched';

    if (suggested && suggested !== item.status) {
      mismatches.push({
        mediaItemId: item.id,
        title: item.title,
        currentStatus: item.status,
        suggestedStatus: suggested,
        episodesWatched: watched,
        episodesTotal: total,
      });
    }
  }

  return mismatches;
}

export interface HistoryEntry {
  key: string;
  mediaItemId: string;
  title: string;
  posterUrl: string | null;
  type: 'tv' | 'movie';
  watchedAt: string;
  seasonNumber: number | null;
  episodeNumber: number | null;
  episodeTitle: string | null;
}

/** Historique chronologique (le plus récent en premier) : épisodes + films vus. */
export async function getHistory(userId: string, limit = 100): Promise<HistoryEntry[]> {
  const supabase = createClient();

  const { data: episodeRows } = await supabase
    .from('user_episode_progress')
    .select(
      `watched_at,
       episodes (
         id, episode_number, title,
         seasons ( season_number, media_items ( id, title, poster_url ) )
       )`
    )
    .eq('user_id', userId)
    .order('watched_at', { ascending: false })
    .limit(limit);

  const episodeEntries: HistoryEntry[] = (episodeRows ?? [])
    .map((row: any) => {
      const ep = row.episodes;
      const season = ep?.seasons;
      const media = season?.media_items;
      if (!media) return null;
      return {
        key: `ep-${ep.id}`,
        mediaItemId: media.id,
        title: media.title,
        posterUrl: media.poster_url,
        type: 'tv' as const,
        watchedAt: row.watched_at,
        seasonNumber: season.season_number,
        episodeNumber: ep.episode_number,
        episodeTitle: ep.title,
      };
    })
    .filter((e): e is HistoryEntry => e !== null);

  const { data: movieRows } = await supabase
    .from('user_media_status')
    .select('added_at, media_items ( id, title, poster_url, type )')
    .eq('user_id', userId)
    .eq('status', 'watched');

  const movieEntries: HistoryEntry[] = (movieRows ?? [])
    .map((row: any) => row.media_items && row.media_items.type === 'movie'
      ? {
          key: `movie-${row.media_items.id}`,
          mediaItemId: row.media_items.id,
          title: row.media_items.title,
          posterUrl: row.media_items.poster_url,
          type: 'movie' as const,
          watchedAt: row.added_at,
          seasonNumber: null,
          episodeNumber: null,
          episodeTitle: null,
        }
      : null)
    .filter((e): e is HistoryEntry => e !== null);

  return [...episodeEntries, ...movieEntries]
    .sort((a, b) => b.watchedAt.localeCompare(a.watchedAt))
    .slice(0, limit);
}

export interface CalendarEpisode {
  mediaItemId: string;
  title: string;
  posterUrl: string | null;
  seasonNumber: number;
  episodeNumber: number;
  episodeTitle: string | null;
  airDate: string;
  watched: boolean;
}

/** Épisodes (passés et futurs) du mois donné, pour toutes les séries en bibliothèque. */
export async function getCalendarMonth(
  userId: string,
  year: number,
  month: number // 1-12
): Promise<CalendarEpisode[]> {
  const supabase = createClient();

  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const { data: statusRows } = await supabase
    .from('user_media_status')
    .select(
      `media_items (
         id, title, poster_url, type,
         seasons ( season_number, episodes ( id, episode_number, title, air_date ) )
       )`
    )
    .eq('user_id', userId)
    .neq('status', 'dropped');

  const shows = (statusRows ?? [])
    .map((r: any) => r.media_items)
    .filter((m: any) => m && m.type === 'tv' && m.seasons?.length > 0);

  const { data: progressRows } = await supabase
    .from('user_episode_progress')
    .select('episode_id')
    .eq('user_id', userId);
  const watchedIds = new Set((progressRows ?? []).map((r) => r.episode_id));

  const result: CalendarEpisode[] = [];
  for (const show of shows) {
    for (const season of show.seasons as any[]) {
      for (const ep of season.episodes ?? []) {
        if (!ep.air_date || ep.air_date < from || ep.air_date > to) continue;
        result.push({
          mediaItemId: show.id,
          title: show.title,
          posterUrl: show.poster_url,
          seasonNumber: season.season_number,
          episodeNumber: ep.episode_number,
          episodeTitle: ep.title,
          airDate: ep.air_date,
          watched: watchedIds.has(ep.id),
        });
      }
    }
  }

  result.sort((a, b) => a.airDate.localeCompare(b.airDate));
  return result;
}
  episodesWatched: number;
  moviesWatched: number;
  showsWatching: number;
  showsCompleted: number;
  showsWatchlist: number;
  showsDropped: number;
  minutesWatched: number;
  topGenres: { genre: string; count: number }[];
}

/**
 * Stats du profil : nb épisodes/films vus, temps total (épisodes vus +
 * films au statut "watched"), répartition des statuts, genres dominants.
 */
export async function getProfileStats(userId: string): Promise<ProfileStats> {
  const supabase = createClient();

  const { data: statusRows } = await supabase
    .from('user_media_status')
    .select(
      `status,
       media_items ( id, type, genres, runtime_minutes )`
    )
    .eq('user_id', userId);

  const rows = statusRows ?? [];

  let showsWatching = 0;
  let showsCompleted = 0;
  let showsWatchlist = 0;
  let showsDropped = 0;
  let moviesWatched = 0;
  let minutesFromMovies = 0;
  const genreCounts = new Map<string, number>();

  for (const row of rows as any[]) {
    const media = row.media_items;
    if (!media) continue;
    for (const g of media.genres ?? []) {
      genreCounts.set(g, (genreCounts.get(g) ?? 0) + 1);
    }
    if (media.type === 'movie') {
      if (row.status === 'watched') {
        moviesWatched++;
        minutesFromMovies += media.runtime_minutes ?? 0;
      }
      continue;
    }
    if (row.status === 'watching') showsWatching++;
    else if (row.status === 'watched') showsCompleted++;
    else if (row.status === 'watchlist') showsWatchlist++;
    else if (row.status === 'dropped') showsDropped++;
  }

  const { data: progressRows } = await supabase
    .from('user_episode_progress')
    .select('episodes ( runtime_minutes )')
    .eq('user_id', userId);

  const episodesWatched = progressRows?.length ?? 0;
  const minutesFromEpisodes = (progressRows ?? []).reduce((sum: number, r: any) => {
    return sum + (r.episodes?.runtime_minutes ?? 0);
  }, 0);

  const topGenres = Array.from(genreCounts.entries())
    .map(([genre, count]) => ({ genre, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    episodesWatched,
    moviesWatched,
    showsWatching,
    showsCompleted,
    showsWatchlist,
    showsDropped,
    minutesWatched: minutesFromMovies + minutesFromEpisodes,
    topGenres,
  };
}
