'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

interface SeasonBreakdown {
  season: number;
  episodeCount: number;
}

interface SearchResult {
  id: number;
  name: string;
  premiered: string | null;
  image: { medium: string } | null;
  genres: string[];
  totalEpisodes: number | null;
  seasonBreakdown: SeasonBreakdown[];
  alreadyInLibrary: boolean;
  watchedCount: number | null;
}

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set());
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const router = useRouter();

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  async function runSearch(q: string) {
    if (q.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    const requestId = ++requestIdRef.current;
    setLoading(true);
    const res = await fetch(`/api/tvmaze/search?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    if (requestId !== requestIdRef.current) return; // une saisie plus récente a pris le dessus
    setResults(data.results ?? []);
    setLoading(false);
  }

  function handleQueryChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    debounceRef.current = setTimeout(() => runSearch(value), 300);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    runSearch(query);
  }

  async function handleAdd(show: SearchResult, category: 'anime' | 'serie') {
    await fetch('/api/shows/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tvmazeId: show.id, category }),
    });
    setAddedIds((prev) => new Set(prev).add(show.id));
    router.refresh();
  }

  return (
    <div>
      <h1 className="font-display text-3xl mb-6">Ajouter une série ou un anime</h1>
      <p className="text-muted text-sm mb-6">
        Recherche via TVmaze. Les films ne sont pas couverts par cette recherche — ajoute-les via
        un import manuel si besoin.
      </p>

      <form onSubmit={handleSearch} className="flex gap-2 mb-8">
        <input
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          autoFocus
          placeholder="Titre d'une série ou d'un anime…"
          className="flex-1 bg-tape border border-ribbon rounded-tape px-4 py-2.5 placeholder:text-muted/60 focus:border-rec outline-none"
        />
        <button
          type="submit"
          className="bg-rec text-ink font-medium rounded-tape px-4 py-2.5 hover:opacity-90 transition-opacity"
        >
          {loading ? 'Recherche…' : 'Chercher'}
        </button>
      </form>

      <div className="space-y-3">
        {results.map((show) => {
          const isExpanded = expandedId === show.id;
          return (
            <div key={show.id} className="border border-ribbon rounded-tape overflow-hidden">
              <div className="flex gap-3 p-3 items-center">
                {show.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={show.image.medium}
                    alt=""
                    className="w-12 h-16 object-cover rounded-tape flex-shrink-0"
                  />
                ) : (
                  <div className="w-12 h-16 bg-ribbon rounded-tape flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="truncate">{show.name}</p>
                  <p className="text-xs text-muted truncate">
                    {show.premiered?.slice(0, 4)} · {show.genres.join(', ')}
                  </p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {show.totalEpisodes !== null && (
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : show.id)}
                        className="font-mono text-[11px] text-muted tape-counter hover:text-paper underline decoration-dotted"
                      >
                        {show.totalEpisodes} ép. · {show.seasonBreakdown.length} saison
                        {show.seasonBreakdown.length > 1 ? 's' : ''}
                      </button>
                    )}
                    {show.alreadyInLibrary && (
                      <span className="font-mono text-[11px] text-tracking">
                        déjà dans ta bibliothèque
                        {show.watchedCount !== null && show.totalEpisodes
                          ? ` · ${show.watchedCount}/${show.totalEpisodes} vus`
                          : ''}
                      </span>
                    )}
                  </div>
                </div>
                {addedIds.has(show.id) || show.alreadyInLibrary ? (
                  <span className="text-xs text-tracking font-mono flex-shrink-0">Ajouté ✓</span>
                ) : (
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => handleAdd(show, 'anime')}
                      className="text-xs px-2.5 py-1.5 rounded-tape border border-ribbon hover:border-rec transition-colors"
                    >
                      + Anime
                    </button>
                    <button
                      onClick={() => handleAdd(show, 'serie')}
                      className="text-xs px-2.5 py-1.5 rounded-tape border border-ribbon hover:border-rec transition-colors"
                    >
                      + Série
                    </button>
                  </div>
                )}
              </div>

              {isExpanded && show.seasonBreakdown.length > 0 && (
                <div className="border-t border-ribbon bg-tape px-3 py-2.5">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {show.seasonBreakdown.map((s) => (
                      <div
                        key={s.season}
                        className="font-mono text-xs text-muted flex justify-between px-2 py-1"
                      >
                        <span>Saison {s.season}</span>
                        <span className="tape-counter">{s.episodeCount} ép.</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {!loading && results.length === 0 && query.length === 0 && (
          <p className="text-muted text-sm">Tape un titre pour commencer.</p>
        )}
      </div>
    </div>
  );
}
