import { NextResponse } from 'next/server';
import { searchShows, getShowEpisodes } from '@/lib/tvmaze';
import { createClient } from '@/lib/supabase/server';

// Nombre de résultats pour lesquels on va chercher le détail des épisodes.
// Limité pour rester rapide et raisonnable vis-à-vis du rate limit TVmaze.
const MAX_DETAILED = 6;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');
  if (!q || q.trim().length < 2) return NextResponse.json({ results: [] });

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let shows;
  try {
    shows = await searchShows(q);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }

  const topShows = shows.slice(0, MAX_DETAILED);
  const tvmazeIds = topShows.map((s) => s.id);

  // Est-ce que ces séries existent déjà dans notre référentiel ?
  const { data: existingMedia } = await supabase
    .from('media_items')
    .select('id, tvmaze_id')
    .in('tvmaze_id', tvmazeIds.length ? tvmazeIds : [-1]);

  const mediaIdByTvmaze = new Map(
    (existingMedia ?? []).map((m) => [m.tvmaze_id as number, m.id as string])
  );

  // Combien d'épisodes déjà marqués vus par l'utilisateur, par média
  let watchedCountByMedia = new Map<string, number>();
  if (user && existingMedia && existingMedia.length > 0) {
    const { data: progress } = await supabase
      .from('user_episode_progress')
      .select('episodes!inner ( seasons!inner ( media_item_id ) )')
      .eq('user_id', user.id);
    for (const row of progress ?? []) {
      // @ts-expect-error -- forme imbriquée renvoyée par PostgREST
      const mediaId = row.episodes?.seasons?.media_item_id as string | undefined;
      if (!mediaId) continue;
      watchedCountByMedia.set(mediaId, (watchedCountByMedia.get(mediaId) ?? 0) + 1);
    }
  }

  const results = await Promise.all(
    topShows.map(async (show) => {
      let seasonBreakdown: { season: number; episodeCount: number }[] = [];
      let totalEpisodes: number | null = null;
      try {
        const episodes = await getShowEpisodes(show.id);
        const bySeasonCount = new Map<number, number>();
        for (const ep of episodes) {
          bySeasonCount.set(ep.season, (bySeasonCount.get(ep.season) ?? 0) + 1);
        }
        seasonBreakdown = Array.from(bySeasonCount.entries())
          .sort((a, b) => a[0] - b[0])
          .map(([season, episodeCount]) => ({ season, episodeCount }));
        totalEpisodes = episodes.length;
      } catch {
        // pas grave, on affichera juste sans détail d'épisodes
      }

      const mediaId = mediaIdByTvmaze.get(show.id);

      return {
        id: show.id,
        name: show.name,
        premiered: show.premiered,
        image: show.image,
        genres: show.genres,
        totalEpisodes,
        seasonBreakdown,
        alreadyInLibrary: !!mediaId,
        watchedCount: mediaId ? (watchedCountByMedia.get(mediaId) ?? 0) : null,
      };
    })
  );

  // Résultats restants (au-delà de MAX_DETAILED) sans détail d'épisodes,
  // pour ne pas cacher qu'ils existent si la recherche en a trouvé plus.
  const remainder = shows.slice(MAX_DETAILED).map((show) => ({
    id: show.id,
    name: show.name,
    premiered: show.premiered,
    image: show.image,
    genres: show.genres,
    totalEpisodes: null,
    seasonBreakdown: [],
    alreadyInLibrary: mediaIdByTvmaze.has(show.id),
    watchedCount: null,
  }));

  return NextResponse.json({ results: [...results, ...remainder] });
}
