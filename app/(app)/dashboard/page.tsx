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

function isToday(dateStr: string): boolean {
  return dateStr === new Date().toISOString().slice(0, 10);
}

export default async function DashboardPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

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

  const newToday = toWatch.filter((i) => i.airDate && isToday(i.airDate));
  const others = toWatch.filter((i) => !i.airDate || !isToday(i.airDate));

  return (
    <div>
      {/* Header */}
      <div className="flex items-baseline justify-between mb-1">
        <h1 className="font-display text-3xl">À voir</h1>
        {syncedAny && (
          <span className="font-mono text-[10px] text-tracking">↻ synchronisé</span>
        )}
      </div>
      <p className="text-muted text-sm mb-8">
        {toWatch.length === 0
          ? "Rien à rattraper pour l'instant."
          : `${toWatch.length} série${toWatch.length > 1 ? 's' : ''} en attente`}
      </p>

      {/* Sortis aujourd'hui — mis en avant */}
      {newToday.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xs uppercase tracking-widest text-rec font-mono mb-2">
            ● Sorti aujourd'hui
          </h2>
          <div className="space-y-2">
            {newToday.map((item) => (
              <EpisodeRow key={item.mediaItemId} item={item} highlight />
            ))}
          </div>
        </div>
      )}

      {/* Reste de la file */}
      {others.length > 0 && (
        <div className="mb-12">
          {newToday.length > 0 && (
            <h2 className="text-xs uppercase tracking-widest text-muted font-mono mb-2">
              En retard
            </h2>
          )}
          <div className="space-y-2">
            {others.map((item) => (
              <EpisodeRow key={item.mediaItemId} item={item} />
            ))}
          </div>
        </div>
      )}

      {toWatch.length === 0 && (
        <p className="text-muted mb-12">
          Marque une série en « En cours » ou « Vu » pour que les épisodes apparaissent ici.
        </p>
      )}

      {/* À venir */}
      <h2 className="font-display text-xl mb-4">À venir</h2>
      {upcoming.length === 0 ? (
        <p className="text-muted">Aucune sortie programmée pour tes séries suivies.</p>
      ) : (
        <div className="space-y-2">
          {upcoming.map((item) => {
            const soon = new Date(item.airDate).getTime() - Date.now() < 7 * 86400000;
            return (
              <Link
                key={`${item.mediaItemId}-${item.episodeNumber}`}
                href={`/show/${item.mediaItemId}`}
                className="flex items-center gap-3 border border-ribbon rounded-tape p-3 hover:border-rec/60 transition-colors"
              >
                {item.posterUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.posterUrl} alt="" className="w-9 h-12 object-cover rounded-tape flex-shrink-0" />
                ) : (
                  <div className="w-9 h-12 bg-ribbon rounded-tape flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm">{item.title}</p>
                  <p className="text-xs text-muted truncate">
                    S{item.seasonNumber}E{item.episodeNumber}
                    {item.episodeTitle ? ` · ${item.episodeTitle}` : ''}
                  </p>
                </div>
                <span className={`font-mono text-xs flex-shrink-0 tape-counter ${soon ? 'text-tracking' : 'text-muted'}`}>
                  {formatAirDate(item.airDate)}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EpisodeRow({ item, highlight = false }: { item: any; highlight?: boolean }) {
  return (
    <div className={`flex items-center gap-3 border rounded-tape p-3 transition-colors ${
      highlight ? 'border-rec/50 bg-rec/5' : 'border-ribbon hover:border-ribbon/60'
    }`}>
      <Link href={`/show/${item.mediaItemId}`} className="flex-shrink-0">
        {item.posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.posterUrl} alt="" className="w-10 h-14 object-cover rounded-tape" />
        ) : (
          <div className="w-10 h-14 bg-ribbon rounded-tape" />
        )}
      </Link>
      <Link href={`/show/${item.mediaItemId}`} className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{item.title}</p>
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
  );
}