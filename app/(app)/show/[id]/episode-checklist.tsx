'use client';

import { useState, useTransition } from 'react';

interface Episode {
  id: string;
  episode_number: number;
  title: string | null;
  air_date: string | null;
}

export default function EpisodeChecklist({
  seasonNumber,
  episodes,
  watchedEpisodeIds,
}: {
  seasonNumber: number;
  episodes: Episode[];
  watchedEpisodeIds: Set<string>;
}) {
  const [watched, setWatched] = useState(watchedEpisodeIds);
  const [, startTransition] = useTransition();

  const watchedCount = episodes.filter((e) => watched.has(e.id)).length;

  function toggle(episodeId: string) {
    const next = new Set(watched);
    const willBeWatched = !next.has(episodeId);
    if (willBeWatched) next.add(episodeId);
    else next.delete(episodeId);
    setWatched(next);

    startTransition(async () => {
      await fetch('/api/episodes/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ episodeId, watched: willBeWatched }),
      });
    });
  }

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="text-sm uppercase tracking-wide text-muted">Saison {seasonNumber}</h2>
        <span className="font-mono text-xs text-muted tape-counter">
          {watchedCount}/{episodes.length}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {episodes.map((ep) => {
          const isWatched = watched.has(ep.id);
          return (
            <button
              key={ep.id}
              onClick={() => toggle(ep.id)}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-tape border text-left text-sm transition-colors ${
                isWatched
                  ? 'border-tracking/50 bg-tracking/10'
                  : 'border-ribbon hover:border-muted'
              }`}
            >
              <span
                className={`w-4 h-4 rounded-tape border flex-shrink-0 flex items-center justify-center text-[10px] ${
                  isWatched ? 'bg-tracking border-tracking text-ink' : 'border-muted'
                }`}
              >
                {isWatched ? '✓' : ''}
              </span>
              <span className="font-mono text-xs text-muted">{ep.episode_number}</span>
              <span className="truncate">{ep.title ?? `Épisode ${ep.episode_number}`}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
