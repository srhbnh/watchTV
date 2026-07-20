import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getLibrary } from '@/lib/data';
import type { LibraryItem, WatchStatus } from '@/lib/types';
import ResyncAllButton from './resync-all-button';

type SubFilter = 'all' | 'anime' | 'serie' | 'movie';

const TABS: { key: WatchStatus; label: string }[] = [
  { key: 'watching', label: 'En cours' },
  { key: 'watched', label: 'Vu' },
  { key: 'watchlist', label: 'À voir' },
  { key: 'dropped', label: 'Abandonné' },
];

const SUBS: { key: SubFilter; label: string }[] = [
  { key: 'all', label: 'Tout' },
  { key: 'anime', label: 'Anime' },
  { key: 'serie', label: 'Séries' },
  { key: 'movie', label: 'Films' },
];

function matchesSub(item: LibraryItem, sub: SubFilter) {
  if (sub === 'all') return true;
  if (sub === 'movie') return item.type === 'movie';
  if (sub === 'anime') return item.category === 'anime';
  return item.type === 'tv' && item.category !== 'anime';
}

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: { status?: string; sub?: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const activeStatus = (searchParams.status as WatchStatus) || 'watching';
  const activeSub = (searchParams.sub as SubFilter) || 'all';
  const items = await getLibrary(user.id);
  const byStatus = items.filter((i) => i.status === activeStatus);
  const filtered = byStatus.filter((i) => matchesSub(i, activeSub));

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <h1 className="font-display text-3xl">Bibliothèque</h1>
        <ResyncAllButton
          mediaItemIds={items.filter((i) => i.type === 'tv' && i.tvmaze_id).map((i) => i.id)}
        />
      </div>

      {/* Onglets statut */}
      <div className="flex border-b border-ribbon mb-4 overflow-x-auto">
        {TABS.map((tab) => {
          const count = items.filter((i) => i.status === tab.key).length;
          const isActive = tab.key === activeStatus;
          return (
            <Link
              key={tab.key}
              href={`/library?status=${tab.key}&sub=${activeSub}`}
              className={`px-4 py-2.5 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors ${
                isActive ? 'border-rec text-paper' : 'border-transparent text-muted hover:text-paper'
              }`}
            >
              {tab.label}
              <span className="font-mono text-[11px] ml-1.5 text-muted tape-counter">({count})</span>
            </Link>
          );
        })}
      </div>

      {/* Sous-filtres */}
      <div className="flex gap-1.5 mb-6 flex-wrap">
        {SUBS.map((sf) => {
          const count = byStatus.filter((i) => matchesSub(i, sf.key)).length;
          const isActive = sf.key === activeSub;
          return (
            <Link
              key={sf.key}
              href={`/library?status=${activeStatus}&sub=${sf.key}`}
              className={`text-xs px-3 py-1.5 rounded-tape border transition-colors ${
                isActive ? 'bg-tape border-rec text-paper' : 'border-ribbon text-muted hover:text-paper'
              }`}
            >
              {sf.label} <span className="font-mono">{count}</span>
            </Link>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <p className="text-muted">Rien ici pour l&apos;instant.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {filtered.map((item) => (
            <Link
              key={item.id}
              href={`/show/${item.id}`}
              className="group border border-ribbon rounded-tape overflow-hidden bg-tape hover:border-rec/60 transition-colors"
            >
              <div className="aspect-[2/3] bg-ribbon relative">
                {item.poster_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.poster_url} alt="" className="w-full h-full object-cover group-hover:opacity-90 transition-opacity" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted text-xs px-2 text-center">
                    {item.title}
                  </div>
                )}
                {item.category && (
                  <span className="absolute top-1.5 left-1.5 bg-ink/90 text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-tape font-mono text-muted">
                    {item.category}
                  </span>
                )}
                {/* Barre de progression */}
                {item.type === 'tv' && item.episodes_total && item.episodes_total > 0 && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black/40">
                    <div
                      className="h-full bg-rec"
                      style={{ width: `${Math.min(100, (item.episodes_watched / item.episodes_total) * 100)}%` }}
                    />
                  </div>
                )}
              </div>
              <div className="p-2">
                <p className="text-xs leading-tight line-clamp-2 mb-1">{item.title}</p>
                {item.type === 'tv' && item.episodes_total ? (
                  <p className="font-mono text-[10px] text-muted tape-counter">
                    {item.episodes_watched}/{item.episodes_total}
                  </p>
                ) : item.runtime_minutes ? (
                  <p className="font-mono text-[10px] text-muted">{item.runtime_minutes} min</p>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}