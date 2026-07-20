import { createClient } from '@/lib/supabase/server';
import { getProfileStats } from '@/lib/data';

function formatMinutes(total: number): string {
  const hours = Math.floor(total / 60);
  const days = Math.floor(hours / 24);
  if (days >= 1) return `${days} j ${hours % 24} h`;
  if (hours >= 1) return `${hours} h ${total % 60} min`;
  return `${total} min`;
}

export default async function ProfilePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const stats = await getProfileStats(user.id);
  const totalShows =
    stats.showsWatching + stats.showsCompleted + stats.showsWatchlist + stats.showsDropped;

  return (
    <div>
      <h1 className="font-display text-3xl mb-1">Profil</h1>
      <p className="text-muted text-sm mb-8">{user.email}</p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
        <StatCard label="Temps total" value={formatMinutes(stats.minutesWatched)} />
        <StatCard label="Épisodes vus" value={String(stats.episodesWatched)} />
        <StatCard label="Films vus" value={String(stats.moviesWatched)} />
        <StatCard label="Séries suivies" value={String(totalShows)} />
      </div>

      <h2 className="font-display text-xl mb-4">Répartition des séries</h2>
      <div className="space-y-2 mb-10">
        <StatusRow label="En cours" count={stats.showsWatching} total={totalShows} />
        <StatusRow label="Terminées" count={stats.showsCompleted} total={totalShows} />
        <StatusRow label="À voir" count={stats.showsWatchlist} total={totalShows} />
        <StatusRow label="Abandonnées" count={stats.showsDropped} total={totalShows} />
      </div>

      {stats.topGenres.length > 0 && (
        <>
          <h2 className="font-display text-xl mb-4">Genres favoris</h2>
          <div className="flex flex-wrap gap-2">
            {stats.topGenres.map((g) => (
              <span
                key={g.genre}
                className="font-mono text-xs px-3 py-1.5 rounded-tape border border-ribbon text-muted"
              >
                {g.genre} <span className="text-tracking">({g.count})</span>
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-ribbon rounded-tape p-4">
      <p className="font-mono text-2xl tape-counter">{value}</p>
      <p className="text-xs text-muted mt-1">{label}</p>
    </div>
  );
}

function StatusRow({ label, count, total }: { label: string; count: number; total: number }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm w-28 flex-shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-tape rounded-tape overflow-hidden">
        <div className="h-full bg-rec" style={{ width: `${pct}%` }} />
      </div>
      <span className="font-mono text-xs text-muted w-10 text-right tape-counter">{count}</span>
    </div>
  );
}
