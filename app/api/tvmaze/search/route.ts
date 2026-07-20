import { NextResponse } from 'next/server';
import { searchShows } from '@/lib/tvmaze';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');
  if (!q || q.trim().length < 2) return NextResponse.json({ results: [] });

  try {
    const results = await searchShows(q);
    return NextResponse.json({ results });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
