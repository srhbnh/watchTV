'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ResyncAllButton({ mediaItemIds }: { mediaItemIds: string[] }) {
  const [status, setStatus] = useState<'idle' | 'running' | 'done'>('idle');
  const [progress, setProgress] = useState(0);
  const router = useRouter();

  async function run() {
    setStatus('running');
    setProgress(0);
    const CONCURRENCY = 4;
    const queue = [...mediaItemIds];
    let done = 0;

    async function worker() {
      while (queue.length > 0) {
        const id = queue.shift();
        if (!id) return;
        try {
          await fetch('/api/shows/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mediaItemId: id }),
          });
        } catch {
          // une série en échec n'empêche pas les autres
        }
        done++;
        setProgress(done);
      }
    }

    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    setStatus('done');
    router.refresh();
  }

  if (status === 'done') {
    return <span className="text-xs text-tracking font-mono">Séries à jour ✓</span>;
  }

  return (
    <button
      onClick={run}
      disabled={status === 'running'}
      className="text-xs px-3 py-1.5 rounded-tape border border-ribbon text-muted hover:text-paper hover:border-rec transition-colors font-mono whitespace-nowrap disabled:opacity-60"
    >
      {status === 'running'
        ? `Resync… ${progress}/${mediaItemIds.length}`
        : 'Resynchroniser toutes les séries'}
    </button>
  );
}
