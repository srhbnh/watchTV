import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getStatusMismatches } from '@/lib/data';

export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const mismatches = await getStatusMismatches(user.id);

  for (const m of mismatches) {
    await supabase
      .from('user_media_status')
      .update({ status: m.suggestedStatus })
      .eq('user_id', user.id)
      .eq('media_item_id', m.mediaItemId);
  }

  return NextResponse.json({ ok: true, fixed: mismatches.length });
}
