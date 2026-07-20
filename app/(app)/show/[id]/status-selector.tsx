'use client';

import { useState, useTransition } from 'react';
import type { WatchStatus } from '@/lib/types';

const OPTIONS: { key: WatchStatus; label: string }[] = [
  { key: 'watchlist', label: 'À voir' },
  { key: 'watching', label: 'En cours' },
  { key: 'watched', label: 'Vu' },
  { key: 'dropped', label: 'Abandonné' },
];

export default function StatusSelector({
  mediaItemId,
  initialStatus,
}: {
  mediaItemId: string;
  initialStatus: WatchStatus;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [isPending, startTransition] = useTransition();

  function handleChange(newStatus: WatchStatus) {
    setStatus(newStatus);
    startTransition(async () => {
      await fetch('/api/shows/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaItemId, status: newStatus }),
      });
    });
  }

  return (
    <div className="flex gap-2 flex-wrap">
      {OPTIONS.map((opt) => (
        <button
          key={opt.key}
          onClick={() => handleChange(opt.key)}
          disabled={isPending}
          className={`text-sm px-3 py-1.5 rounded-tape border transition-colors ${
            status === opt.key
              ? 'bg-rec border-rec text-ink'
              : 'border-ribbon text-muted hover:text-paper'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
