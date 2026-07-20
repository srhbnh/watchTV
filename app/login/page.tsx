'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Mode = 'password' | 'magic-link';
type PasswordAction = 'sign-in' | 'sign-up';

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('password');
  const [action, setAction] = useState<PasswordAction>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setStatus('sending');
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setStatus(error ? 'error' : 'sent');
    if (error) setErrorMessage(error.message);
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('sending');
    setErrorMessage('');
    const supabase = createClient();

    if (action === 'sign-up') {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) {
        setStatus('error');
        setErrorMessage(error.message);
      } else {
        setStatus('sent'); // demande de confirmation par email
      }
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setStatus('error');
      setErrorMessage(
        error.message.includes('Invalid login credentials')
          ? 'Email ou mot de passe incorrect.'
          : error.message
      );
    } else {
      window.location.href = '/library';
    }
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

        {mode === 'password' ? (
          <>
            <div className="flex gap-1 mb-6 border border-ribbon rounded-tape p-1">
              <button
                onClick={() => {
                  setAction('sign-in');
                  setStatus('idle');
                }}
                className={`flex-1 text-sm py-2 rounded-tape transition-colors ${
                  action === 'sign-in' ? 'bg-tape text-paper' : 'text-muted'
                }`}
              >
                Se connecter
              </button>
              <button
                onClick={() => {
                  setAction('sign-up');
                  setStatus('idle');
                }}
                className={`flex-1 text-sm py-2 rounded-tape transition-colors ${
                  action === 'sign-up' ? 'bg-tape text-paper' : 'text-muted'
                }`}
              >
                Créer un compte
              </button>
            </div>

            {status === 'sent' && action === 'sign-up' ? (
              <div className="border border-tracking/40 bg-tracking/10 rounded-tape p-4 text-sm">
                Compte créé. Va confirmer ton adresse via l&apos;email envoyé à{' '}
                <strong>{email}</strong>, puis reviens te connecter.
              </div>
            ) : (
              <form onSubmit={handlePasswordSubmit} className="space-y-3">
                <div>
                  <label htmlFor="email" className="block text-sm text-muted mb-1">
                    Adresse email
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="toi@exemple.com"
                    className="w-full bg-tape border border-ribbon rounded-tape px-4 py-3 placeholder:text-muted/60 focus:border-rec outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="password" className="block text-sm text-muted mb-1">
                    Mot de passe
                  </label>
                  <input
                    id="password"
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-tape border border-ribbon rounded-tape px-4 py-3 placeholder:text-muted/60 focus:border-rec outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={status === 'sending'}
                  className="w-full bg-rec text-ink font-medium rounded-tape px-4 py-3 hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {status === 'sending'
                    ? 'Un instant…'
                    : action === 'sign-up'
                      ? 'Créer mon compte'
                      : 'Se connecter'}
                </button>
                {status === 'error' && (
                  <p className="text-sm text-rec">{errorMessage}</p>
                )}
              </form>
            )}

            <button
              onClick={() => {
                setMode('magic-link');
                setStatus('idle');
              }}
              className="w-full text-center text-xs text-muted hover:text-paper mt-5 transition-colors"
            >
              Préférer un lien de connexion par email
            </button>
          </>
        ) : (
          <>
            {status === 'sent' ? (
              <div className="border border-tracking/40 bg-tracking/10 rounded-tape p-4 text-sm">
                Lien envoyé à <strong>{email}</strong>. Ouvre-le depuis cet appareil pour te
                connecter.
              </div>
            ) : (
              <form onSubmit={handleMagicLink} className="space-y-3">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="toi@exemple.com"
                  className="w-full bg-tape border border-ribbon rounded-tape px-4 py-3 placeholder:text-muted/60 focus:border-rec outline-none"
                />
                <button
                  type="submit"
                  disabled={status === 'sending'}
                  className="w-full bg-rec text-ink font-medium rounded-tape px-4 py-3 hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {status === 'sending' ? 'Envoi du lien…' : 'Recevoir mon lien de connexion'}
                </button>
                {status === 'error' && <p className="text-sm text-rec">{errorMessage}</p>}
              </form>
            )}
            <button
              onClick={() => {
                setMode('password');
                setStatus('idle');
              }}
              className="w-full text-center text-xs text-muted hover:text-paper mt-5 transition-colors"
            >
              Utiliser un mot de passe à la place
            </button>
          </>
        )}
      </div>
    </main>
  );
}
