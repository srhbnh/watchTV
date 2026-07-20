const BASE = 'https://api.tvmaze.com';

export interface TvmazeShow {
  id: number;
  name: string;
  genres: string[];
  runtime: number | null;
  premiered: string | null;
  image: { medium: string; original: string } | null;
  externals: { imdb: string | null; thetvdb: number | null };
  _embedded?: {
    nextepisode?: TvmazeEpisode;
    previousepisode?: TvmazeEpisode;
  };
}

export interface TvmazeEpisode {
  id: number;
  name: string;
  season: number;
  number: number;
  airdate: string | null;
  airstamp: string | null;
}

export async function searchShows(query: string): Promise<TvmazeShow[]> {
  const res = await fetch(`${BASE}/search/shows?q=${encodeURIComponent(query)}`, {
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`TVmaze search failed: ${res.status}`);
  const results: { show: TvmazeShow }[] = await res.json();
  return results.map((r) => r.show);
}

export async function getShowWithNextEpisode(tvmazeId: number): Promise<TvmazeShow> {
  const res = await fetch(`${BASE}/shows/${tvmazeId}?embed[]=nextepisode&embed[]=previousepisode`, {
    next: { revalidate: 1800 },
  });
  if (!res.ok) throw new Error(`TVmaze show fetch failed: ${res.status}`);
  return res.json();
}

export async function getShowEpisodes(tvmazeId: number): Promise<TvmazeEpisode[]> {
  const res = await fetch(`${BASE}/shows/${tvmazeId}/episodes`, {
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`TVmaze episodes fetch failed: ${res.status}`);
  return res.json();
}
