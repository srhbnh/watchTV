'use client';

import { useState, useTransition } from 'react';

interface Episode {
  id: string;
  episode_number: number;
  title: string | null;
  air_date: string | null;
  runtime_minutes?: number | null;
}

function formatDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
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
  const today = new Date().toISOString().slice(0, 10);

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
          const notYetAired = !!ep.air_date && ep.air_date > today;
          const dateLabel = formatDate(ep.air_date);
          return (
            <button
              key={ep.id}
              onClick={() => toggle(ep.id)}
              disabled={notYetAired}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-tape border text-left text-sm transition-colors ${
                isWatched
                  ? 'border-tracking/50 bg-tracking/10'
                  : notYetAired
                    ? 'border-ribbon opacity-50 cursor-not-allowed'
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
              <span className="font-mono text-xs text-muted flex-shrink-0">{ep.episode_number}</span>
              <span className="truncate flex-1">{ep.title ?? `Épisode ${ep.episode_number}`}</span>
              {dateLabel && (
                <span className="font-mono text-[10px] text-muted flex-shrink-0">{dateLabel}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
