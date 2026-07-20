'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('sending');
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setStatus(error ? 'error' : 'sent');
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-10">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full rounded-full bg-rec opacity-75 animate-ping" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-rec" />
          </span>
          <span className="font-mono text-xs tracking-[0.2em] text-muted uppercase">
            En attente de connexion
          </span>
        </div>

        <h1 className="font-display text-4xl mb-2">WatchNext</h1>
        <p className="text-muted mb-8">
          Ta bibliothèque, tes données, pas de fermeture surprise.
        </p>

        {status === 'sent' ? (
          <div className="border border-tracking/40 bg-tracking/10 rounded-tape p-4 text-sm">
            Lien envoyé à <strong>{email}</strong>. Ouvre-le depuis cet appareil pour te connecter.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <label htmlFor="email" className="block text-sm text-muted">
              Adresse email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="toi@exemple.com"
              className="w-full bg-tape border border-ribbon rounded-tape px-4 py-3 text-paper placeholder:text-muted/60 focus:border-rec outline-none"
            />
            <button
              type="submit"
              disabled={status === 'sending'}
              className="w-full bg-rec text-ink font-medium rounded-tape px-4 py-3 hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {status === 'sending' ? 'Envoi du lien…' : 'Recevoir mon lien de connexion'}
            </button>
            {status === 'error' && (
              <p className="text-sm text-rec">
                Le lien n&apos;a pas pu être envoyé. Vérifie l&apos;adresse et réessaie.
              </p>
            )}
          </form>
        )}
      </div>
    </main>
  );
}
