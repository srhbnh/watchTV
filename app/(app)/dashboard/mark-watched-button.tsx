import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export default function MarkWatchedButton({ episodeId }: { episodeId: string }) {
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (done) return <span className="text-tracking font-mono text-xs flex-shrink-0">✓</span>;

  return (
    <button
      onClick={() => {
        setDone(true);
        startTransition(async () => {
          await fetch('/api/episodes/toggle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ episodeId, watched: true }),
          });
          router.refresh();
        });
      }}
      disabled={isPending}
      className="flex-shrink-0 w-9 h-9 rounded-tape bg-rec text-ink font-bold text-base hover:opacity-90 disabled:opacity-50 transition-opacity"
      title="Marquer vu"
    >
      ✓
    </button>
  );
}