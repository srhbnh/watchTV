import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getLibrary } from '@/lib/data';
import type { WatchStatus } from '@/lib/types';

const TABS: { key: WatchStatus; label: string }[] = [
  { key: 'watched', label: 'Vu' },
  { key: 'watching', label: 'En cours' },
  { key: 'watchlist', label: 'À voir' },
  { key: 'dropped', label: 'Abandonné' },
];

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const activeStatus = (searchParams.status as WatchStatus) || 'watched';
  const items = await getLibrary(user.id);
  const filtered = items.filter((i) => i.status === activeStatus);

  return (
    <div>
      <h1 className="font-display text-3xl mb-6">Bibliothèque</h1>

      <div className="flex gap-1 border-b border-ribbon mb-8 overflow-x-auto">
        {TABS.map((tab) => {
          const count = items.filter((i) => i.status === tab.key).length;
          const isActive = tab.key === activeStatus;
          return (
            <Link
              key={tab.key}
              href={`/library?status=${tab.key}`}
              className={`px-4 py-2.5 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors ${
                isActive
                  ? 'border-rec text-paper'
                  : 'border-transparent text-muted hover:text-paper'
              }`}
            >
              {tab.label}{' '}
              <span className="font-mono text-xs text-muted">({count})</span>
            </Link>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <p className="text-muted">
          Rien ici pour l&apos;instant. Va dans « Ajouter » pour chercher une série ou un film.
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {filtered.map((item) => (
            <Link
              key={item.id}
              href={`/show/${item.id}`}
              className="group border border-ribbon rounded-tape overflow-hidden bg-tape hover:border-rec/60 transition-colors"
            >
              <div className="aspect-[2/3] bg-ribbon relative">
                {item.poster_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.poster_url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted text-xs px-2 text-center">
                    {item.title}
                  </div>
                )}
                {item.category && (
                  <span className="absolute top-2 left-2 bg-ink/80 text-paper text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-tape font-mono">
                    {item.category}
                  </span>
                )}
              </div>
              <div className="p-2.5">
                <p className="text-sm leading-tight line-clamp-2 mb-1">{item.title}</p>
                {item.episodes_total ? (
                  <p className="font-mono text-[11px] text-muted tape-counter">
                    {item.episodes_watched}/{item.episodes_total} ép.
                  </p>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
