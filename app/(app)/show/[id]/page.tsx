import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { syncShowEpisodes } from '@/lib/sync';
import StatusSelector from './status-selector';
import EpisodeChecklist from './episode-checklist';

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  Running: { label: '▶ En diffusion', color: 'text-tracking' },
  Ended: { label: '■ Terminée', color: 'text-muted' },
  'To Be Determined': { label: '⏸ En pause', color: 'text-muted' },
};

export default async function ShowDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: mediaHead } = await supabase
    .from('media_items')
    .select('id, tvmaze_id, tv_status, last_synced_at')
    .eq('id', params.id)
    .maybeSingle();

  if (mediaHead?.tvmaze_id) {
    const isStale =
      !mediaHead.last_synced_at ||
      Date.now() - new Date(mediaHead.last_synced_at).getTime() > 3600000;
    if (isStale) {
      try { await syncShowEpisodes(mediaHead.id, mediaHead.tvmaze_id); } catch {}
    }
  }

  const { data: media } = await supabase
    .from('media_items')
    .select('*, seasons ( id, season_number, episodes ( id, episode_number, title, air_date, runtime_minutes ) )')
    .eq('id', params.id)
    .maybeSingle();

  if (!media) notFound();

  const { data: statusRow } = await supabase
    .from('user_media_status')
    .select('status')
    .eq('user_id', user.id)
    .eq('media_item_id', media.id)
    .maybeSingle();

  const { data: progressRows } = await supabase
    .from('user_episode_progress')
    .select('episode_id')
    .eq('user_id', user.id);

  const watchedEpisodeIds = new Set((progressRows ?? []).map((r) => r.episode_id));

  const seasons = (media.seasons ?? []).sort((a: any, b: any) => a.season_number - b.season_number);
  const allEps = seasons.flatMap((s: any) => (s.episodes ?? []).map((e: any) => ({ ...e, season_number: s.season_number })));
  const totalEpisodes = allEps.length;
  const totalWatched = allEps.filter((e: any) => watchedEpisodeIds.has(e.id)).length;
  const pct = totalEpisodes > 0 ? Math.round((totalWatched / totalEpisodes) * 100) : 0;

  const today = new Date().toISOString().slice(0, 10);
  const nextToWatch = allEps
    .filter((e: any) => !watchedEpisodeIds.has(e.id) && (!e.air_date || e.air_date <= today))
    .sort((a: any, b: any) => a.season_number - b.season_number || (a.episode_number ?? 0) - (b.episode_number ?? 0))[0];

  const tvStatus = STATUS_LABEL[media.tv_status] ?? null;

  // Temps total estimé restant
  const avgRuntime = media.runtime_minutes ?? 0;
  const remainingEps = totalEpisodes - totalWatched;
  const remainingMinutes = remainingEps * avgRuntime;
  const remainingHours = avgRuntime > 0 ? Math.round(remainingMinutes / 60) : null;

  return (
    <div>
      {/* Header avec poster */}
      <div className="flex gap-4 mb-6">
        {media.poster_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={media.poster_url} alt="" className="w-28 h-40 object-cover rounded-tape flex-shrink-0 shadow-lg" />
        ) : (
          <div className="w-28 h-40 bg-ribbon rounded-tape flex-shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            {media.category && (
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted border border-ribbon px-1.5 py-0.5 rounded-tape">
                {media.category === 'anime' ? 'Anime' : 'Série'}
              </span>
            )}
            {tvStatus && (
              <span className={`font-mono text-[10px] ${tvStatus.color}`}>{tvStatus.label}</span>
            )}
          </div>
          <h1 className="font-display text-2xl leading-tight">{media.title}</h1>
          {media.genres?.length > 0 && (
            <p className="text-xs text-muted mt-1">{media.genres.join(' · ')}</p>
          )}
          {media.release_date && (
            <p className="text-xs text-muted mt-0.5">{media.release_date.slice(0, 4)}</p>
          )}
          {/* Stats rapides */}
          {totalEpisodes > 0 && (
            <div className="mt-3 space-y-1.5">
              <div className="flex justify-between text-[11px] font-mono text-muted tape-counter">
                <span>{totalWatched}/{totalEpisodes} épisodes · {pct}%</span>
                {remainingHours !== null && remainingHours > 0 && (
                  <span>~{remainingHours}h restantes</span>
                )}
              </div>
              <div className="h-1 bg-ribbon rounded-full overflow-hidden">
                <div className="h-full bg-rec transition-all" style={{ width: `${pct}%` }} />
              </div>
              {nextToWatch && (
                <p className="text-[11px] text-tracking font-mono">
                  → Prochain : S{nextToWatch.season_number}E{nextToWatch.episode_number ?? '?'}
                  {nextToWatch.title ? ` · ${nextToWatch.title}` : ''}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Statut + actions */}
      <div className="mb-6">
        <StatusSelector mediaItemId={media.id} initialStatus={statusRow?.status ?? 'watchlist'} />
      </div>

      {/* Saisons */}
      {media.type === 'tv' && seasons.length > 0 && (
        <div className="space-y-3">
          {seasons.map((season: any) => (
            <EpisodeChecklist
              key={season.id}
              seasonNumber={season.season_number}
              episodes={(season.episodes ?? []).sort(
                (a: any, b: any) => (a.episode_number ?? 0) - (b.episode_number ?? 0)
              )}
              watchedEpisodeIds={watchedEpisodeIds}
            />
          ))}
        </div>
      )}
    </div>
  );
}