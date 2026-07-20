import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { syncShowEpisodes } from '@/lib/sync';

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const { mediaItemId } = await request.json();
  if (!mediaItemId) return NextResponse.json({ error: 'mediaItemId manquant' }, { status: 400 });

  const { data: media } = await supabase
    .from('media_items')
    .select('id, tvmaze_id')
    .eq('id', mediaItemId)
    .maybeSingle();

  if (!media?.tvmaze_id) {
    return NextResponse.json({ error: 'Pas de tvmaze_id pour cette série' }, { status: 400 });
  }

  try {
    const result = await syncShowEpisodes(media.id, media.tvmaze_id);
    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
