import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const { episodeId, watched } = await request.json();
  if (!episodeId || typeof watched !== 'boolean') {
    return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 });
  }

  if (watched) {
    const { error } = await supabase.from('user_episode_progress').upsert(
      {
        user_id: user.id,
        episode_id: episodeId,
        watched_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,episode_id' }
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await supabase
      .from('user_episode_progress')
      .delete()
      .eq('user_id', user.id)
      .eq('episode_id', episodeId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
