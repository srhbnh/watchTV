import { createClient } from '@/lib/supabase/server';
import { getShowWithNextEpisode } from '@/lib/tvmaze';
import Link from 'next/link';

interface UpcomingItem {
  mediaItemId: string;
  title: string;
  category: string | null;
  posterUrl: string | null;
  episodeName: string;
  seasonNumber: number;
  episodeNumber: number;
  airdate: string;
}

export default async function UpcomingPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Séries actives (en cours ou en watchlist) avec un id TVmaze connu
  const { data: statusRows } = await supabase
    .from('user_media_status')
    .select('media_items ( id, title, category, poster_url, tvmaze_id, type )')
    .eq('user_id', user.id)
    .in('status', ['watching', 'watched']);

  const shows = (statusRows ?? [])
    .map((r: any) => r.media_items)
    .filter((m: any) => m && m.type === 'tv' && m.tvmaze_id);

  const upcoming: UpcomingItem[] = [];

  // Requêtes en série pour rester raisonnable vis-à-vis de l'API TVmaze
  for (const show of shows) {
    try {
      const details = await getShowWithNextEpisode(show.tvmaze_id);
      const next = details._embedded?.nextepisode;
      if (next?.airdate) {
        upcoming.push({
          mediaItemId: show.id,
          title: show.title,
          category: show.category,
          posterUrl: show.poster_url,
          episodeName: next.name,
          seasonNumber: next.season,
          episodeNumber: next.number,
          airdate: next.airdate,
        });
      }
    } catch {
      // série sans info de diffusion future disponible, on ignore
    }
  }

  upcoming.sort((a, b) => a.airdate.localeCompare(b.airdate));

  return (
    <div>
      <h1 className="font-display text-3xl mb-6">À venir</h1>

      {shows.length === 0 ? (
        <p className="text-muted">
          Marque des séries comme « Vu » ou « En cours » pour voir apparaître ici leurs prochains
          épisodes.
        </p>
      ) : upcoming.length === 0 ? (
        <p className="text-muted">
          Aucune date de diffusion à venir connue pour tes séries suivies actuellement.
        </p>
      ) : (
        <div className="space-y-2">
          {upcoming.map((item) => (
            <Link
              key={item.mediaItemId}
              href={`/show/${item.mediaItemId}`}
              className="flex items-center gap-4 border border-ribbon rounded-tape p-3 hover:border-rec/60 transition-colors"
            >
              <div className="font-mono text-xs text-tracking w-20 flex-shrink-0 tape-counter">
                {new Date(item.airdate).toLocaleDateString('fr-FR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                })}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate">{item.title}</p>
                <p className="text-xs text-muted truncate">
                  S{item.seasonNumber}E{item.episodeNumber} · {item.episodeName}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
