import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getShowEpisodes, getShowWithNextEpisode } from '@/lib/tvmaze';

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const { tvmazeId, category } = await request.json();
  if (!tvmazeId) return NextResponse.json({ error: 'tvmazeId manquant' }, { status: 400 });

  const show = await getShowWithNextEpisode(tvmazeId);
  const episodes = await getShowEpisodes(tvmazeId);

  const { data: existing } = await supabase
    .from('media_items')
    .select('id')
    .eq('tvmaze_id', tvmazeId)
    .maybeSingle();

  let mediaItemId: string;

  const mediaPayload = {
    tvmaze_id: show.id,
    imdb_id: show.externals?.imdb ?? null,
    title: show.name,
    type: 'tv' as const,
    category: category ?? null,
    genres: show.genres ?? [],
    runtime_minutes: show.runtime,
    release_date: show.premiered,
    poster_url: show.image?.original ?? null,
  };

  if (existing) {
    mediaItemId = existing.id;
    await supabase.from('media_items').update(mediaPayload).eq('id', mediaItemId);
  } else {
    const { data, error } = await supabase
      .from('media_items')
      .insert(mediaPayload)
      .select('id')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    mediaItemId = data.id;
  }

  // Regrouper les épisodes TVmaze par saison et les upserter
  const seasonNumbers = Array.from(new Set(episodes.map((e) => e.season)));
  for (const seasonNumber of seasonNumbers) {
    const { data: existingSeason } = await supabase
      .from('seasons')
      .select('id')
      .eq('media_item_id', mediaItemId)
      .eq('season_number', seasonNumber)
      .maybeSingle();

    const seasonId =
      existingSeason?.id ??
      (
        await supabase
          .from('seasons')
          .insert({ media_item_id: mediaItemId, season_number: seasonNumber })
          .select('id')
          .single()
      ).data?.id;

    if (!seasonId) continue;

    const seasonEpisodes = episodes.filter((e) => e.season === seasonNumber);
    for (const ep of seasonEpisodes) {
      await supabase.from('episodes').upsert(
        {
          season_id: seasonId,
          episode_number: ep.number,
          title: ep.name,
          air_date: ep.airdate,
          tvmaze_episode_id: ep.id,
        },
        { onConflict: 'season_id,episode_number' }
      );
    }
  }

  await supabase.from('user_media_status').upsert(
    {
      user_id: user.id,
      media_item_id: mediaItemId,
      status: 'watchlist',
      added_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,media_item_id' }
  );

  return NextResponse.json({ ok: true, mediaItemId });
}
