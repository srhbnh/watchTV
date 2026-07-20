'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface SearchResult {
  id: number;
  name: string;
  premiered: string | null;
  image: { medium: string } | null;
  genres: string[];
}

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set());
  const router = useRouter();

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim().length < 2) return;
    setLoading(true);
    const res = await fetch(`/api/tvmaze/search?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    setResults(data.results ?? []);
    setLoading(false);
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
          onChange={(e) => setQuery(e.target.value)}
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
        {results.map((show) => (
          <div
            key={show.id}
            className="flex gap-3 border border-ribbon rounded-tape p-3 items-center"
          >
            {show.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={show.image.medium} alt="" className="w-12 h-16 object-cover rounded-tape" />
            ) : (
              <div className="w-12 h-16 bg-ribbon rounded-tape" />
            )}
            <div className="flex-1 min-w-0">
              <p className="truncate">{show.name}</p>
              <p className="text-xs text-muted">
                {show.premiered?.slice(0, 4)} · {show.genres.join(', ')}
              </p>
            </div>
            {addedIds.has(show.id) ? (
              <span className="text-xs text-tracking font-mono">Ajouté ✓</span>
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
        ))}
      </div>
    </div>
  );
}
