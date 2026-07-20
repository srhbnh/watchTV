import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const { mediaItemId } = await request.json();
  if (!mediaItemId) return NextResponse.json({ error: 'mediaItemId manquant' }, { status: 400 });

  const today = new Date().toISOString().slice(0, 10);
  const { data: seasons } = await supabase
    .from('seasons').select('id').eq('media_item_id', mediaItemId);
  if (!seasons?.length) return NextResponse.json({ ok: true, count: 0 });

  const { data: episodes } = await supabase
    .from('episodes').select('id')
    .in('season_id', seasons.map((s) => s.id))
    .or(`air_date.is.null,air_date.lte.${today}`);
  if (!episodes?.length) return NextResponse.json({ ok: true, count: 0 });

  const { error } = await supabase.from('user_episode_progress').upsert(
    episodes.map((e) => ({
      user_id: user.id,
      episode_id: e.id,
      watched_at: new Date().toISOString(),
    })),
    { onConflict: 'user_id,episode_id' }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, count: episodes.length });
}