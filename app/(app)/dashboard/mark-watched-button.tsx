'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export default function MarkWatchedButton({ episodeId }: { episodeId: string }) {
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    setDone(true);
    startTransition(async () => {
      await fetch('/api/episodes/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ episodeId, watched: true }),
      });
      router.refresh();
    });
  }

  if (done) {
    return (
      <span className="text-xs px-3 py-1.5 rounded-tape font-mono text-tracking flex-shrink-0">
        Vu ✓
      </span>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className="text-xs px-3 py-1.5 rounded-tape border border-rec text-rec hover:bg-rec hover:text-ink transition-colors flex-shrink-0 font-mono whitespace-nowrap"
    >
      +1 épisode
    </button>
  );
}
