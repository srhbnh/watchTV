import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import StatusSelector from './status-selector';
import EpisodeChecklist from './episode-checklist';

export default async function ShowDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: media } = await supabase
    .from('media_items')
    .select('*, seasons ( id, season_number, episodes ( id, episode_number, title, air_date ) )')
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

  const seasons = (media.seasons ?? []).sort(
    (a: any, b: any) => a.season_number - b.season_number
  );

  return (
    <div>
      <div className="mb-6">
        {media.category && (
          <span className="font-mono text-[11px] uppercase tracking-wide text-muted">
            {media.category === 'anime' ? 'Anime' : 'Série'}
          </span>
        )}
        <h1 className="font-display text-3xl mt-1">{media.title}</h1>
        {media.genres?.length > 0 && (
          <p className="text-muted text-sm mt-1">{media.genres.join(' · ')}</p>
        )}
      </div>

      <StatusSelector
        mediaItemId={media.id}
        initialStatus={statusRow?.status ?? 'watchlist'}
      />

      {media.type === 'tv' && seasons.length > 0 && (
        <div className="mt-8 space-y-6">
          {seasons.map((season: any) => (
            <EpisodeChecklist
              key={season.id}
              seasonNumber={season.season_number}
              episodes={(season.episodes ?? []).sort(
                (a: any, b: any) => a.episode_number - b.episode_number
              )}
              watchedEpisodeIds={watchedEpisodeIds}
            />
          ))}
        </div>
      )}
    </div>
  );
}
