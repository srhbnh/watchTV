import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getDashboard } from '@/lib/data';
import { syncStaleShows } from '@/lib/sync';
import MarkWatchedButton from './mark-watched-button';

function formatAirDate(dateStr: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(dateStr + 'T00:00:00');
  const diffDays = Math.round((date.getTime() - today.getTime()) / 86400000);

  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === -1) return 'Hier';
  if (diffDays === 1) return 'Demain';
  if (diffDays > 1 && diffDays <= 6) return `Dans ${diffDays} jours`;
  if (diffDays < -1 && diffDays >= -6) return `Il y a ${-diffDays} jours`;

  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Rattrape les séries dont on n'a pas revérifié les épisodes récemment,
  // pour que les épisodes fraîchement sortis (ex: sortis aujourd'hui)
  // apparaissent sans action manuelle.
  const { data: followedShows } = await supabase
    .from('user_media_status')
    .select('media_items ( id, tvmaze_id, tv_status, last_synced_at, type )')
    .eq('user_id', user.id)
    .in('status', ['watching', 'watched']);

  const syncCandidates = (followedShows ?? [])
    .map((r: any) => r.media_items)
    .filter((m: any) => m && m.type === 'tv' && m.tvmaze_id)
    .map((m: any) => ({
      mediaItemId: m.id,
      tvmazeId: m.tvmaze_id,
      lastSyncedAt: m.last_synced_at,
      tvStatus: m.tv_status,
    }));

  const { syncedAny } = await syncStaleShows(syncCandidates);

  const { toWatch, upcoming } = await getDashboard(user.id);

  return (
    <div>
      <h1 className="font-display text-3xl mb-1">À voir</h1>
      <p className="text-muted text-sm mb-8">
        {toWatch.length === 0
          ? "Rien de neuf à rattraper pour l'instant."
          : `${toWatch.length} série${toWatch.length > 1 ? 's' : ''} avec un épisode qui t'attend.`}
        {syncedAny ? ' · à jour avec TVmaze' : ''}
      </p>

      {toWatch.length === 0 ? (
        <p className="text-muted mb-10">
          Marque une série comme « En cours » ou « Vu » dans sa fiche pour qu'elle apparaisse ici
          dès qu'un épisode sort.
        </p>
      ) : (
        <div className="space-y-2 mb-12">
          {toWatch.map((item) => (
            <div
              key={item.mediaItemId}
              className="flex items-center gap-3 border border-ribbon rounded-tape p-3 hover:border-rec/60 transition-colors"
            >
              <Link href={`/show/${item.mediaItemId}`} className="flex-shrink-0">
                {item.posterUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.posterUrl} alt="" className="w-10 h-14 object-cover rounded-tape" />
                ) : (
                  <div className="w-10 h-14 bg-ribbon rounded-tape" />
                )}
              </Link>
              <Link href={`/show/${item.mediaItemId}`} className="min-w-0 flex-1">
                <p className="truncate">{item.title}</p>
                <p className="text-xs text-muted truncate">
                  S{item.seasonNumber}E{item.episodeNumber}
                  {item.episodeTitle ? ` · ${item.episodeTitle}` : ''}
                </p>
                <p className="font-mono text-[11px] text-muted tape-counter mt-0.5">
                  {item.airDate ? formatAirDate(item.airDate) : 'date inconnue'}
                  {item.runtimeMinutes ? ` · ${item.runtimeMinutes} min` : ''}
                  {item.remainingCount > 1 ? ` · ${item.remainingCount} en retard` : ''}
                </p>
              </Link>
              <MarkWatchedButton episodeId={item.episodeId} />
            </div>
          ))}
        </div>
      )}

      <h2 className="font-display text-xl mb-4">À venir</h2>
      {upcoming.length === 0 ? (
        <p className="text-muted">Aucune date de diffusion connue pour l'instant.</p>
      ) : (
        <div className="space-y-2">
          {upcoming.map((item) => (
            <Link
              key={`${item.mediaItemId}-${item.episodeNumber}`}
              href={`/show/${item.mediaItemId}`}
              className="flex items-center gap-4 border border-ribbon rounded-tape p-3 hover:border-rec/60 transition-colors"
            >
              <div className="font-mono text-xs text-tracking w-24 flex-shrink-0 tape-counter">
                {formatAirDate(item.airDate)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate">{item.title}</p>
                <p className="text-xs text-muted truncate">
                  S{item.seasonNumber}E{item.episodeNumber}
                  {item.episodeTitle ? ` · ${item.episodeTitle}` : ''}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
