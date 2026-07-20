import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const { mediaItemId, status } = await request.json();
  if (!mediaItemId || !status) {
    return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 });
  }

  const { error } = await supabase.from('user_media_status').upsert(
    {
      user_id: user.id,
      media_item_id: mediaItemId,
      status,
      added_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,media_item_id' }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
