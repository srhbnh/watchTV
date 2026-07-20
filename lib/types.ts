export type MediaType = 'tv' | 'movie';
export type MediaCategory = 'anime' | 'serie' | null;
export type WatchStatus = 'watching' | 'watched' | 'watchlist' | 'dropped';

export interface MediaItem {
  id: string;
  tvmaze_id: number | null;
  tmdb_id: number | null;
  imdb_id: string | null;
  title: string;
  type: MediaType;
  category: MediaCategory;
  genres: string[];
  runtime_minutes: number | null;
  release_date: string | null;
  poster_url: string | null;
  tv_status: string | null;
  last_synced_at: string | null;
}

export interface Season {
  id: string;
  media_item_id: string;
  season_number: number;
}

export interface Episode {
  id: string;
  season_id: string;
  episode_number: number;
  title: string | null;
  air_date: string | null;
  tvmaze_episode_id: number | null;
  runtime_minutes: number | null;
}

export interface UserMediaStatus {
  id: string;
  user_id: string;
  media_item_id: string;
  status: WatchStatus;
  added_at: string;
}

export interface UserEpisodeProgress {
  id: string;
  user_id: string;
  episode_id: string;
  watched_at: string;
}

/** Item de bibliothèque tel qu'affiché dans la Library, avec le statut inclus */
export interface LibraryItem extends MediaItem {
  status: WatchStatus;
  added_at: string;
  episodes_watched: number;
  episodes_total: number | null;
}
