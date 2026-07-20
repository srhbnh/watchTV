import type { Metadata } from 'next';
import { Space_Grotesk, Inter, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import SignOutButton from './sign-out-button';

const display = Space_Grotesk({ subsets: ['latin'], variable: '--font-display' });
const body = Inter({ subsets: ['latin'], variable: '--font-body' });
const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-mono' });
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

export const metadata: Metadata = {
  title: 'WatchNext',
  description: 'Ton suivi de séries, anime et films — chez toi, pour de bon.',
};
  if (!user) redirect('/login');

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body className="font-body bg-ink text-paper min-h-screen">{children}</body>
    </html>
    <div className="min-h-screen flex flex-col md:flex-row">
      <nav className="border-b md:border-b-0 md:border-r border-ribbon md:w-56 md:min-h-screen flex md:flex-col justify-between px-4 md:px-6 py-4 md:py-8">
        <div>
          <Link href="/library" className="font-display text-xl block mb-8">
            WatchNext
          </Link>
          <div className="flex md:flex-col gap-1 text-sm">
            <NavLink href="/library">Bibliothèque</NavLink>
            <NavLink href="/upcoming">À suivre</NavLink>
            <NavLink href="/search">Ajouter</NavLink>
            <NavLink href="/profile">Profil</NavLink>
          </div>
        </div>
        <div className="hidden md:block">
          <SignOutButton />
        </div>
      </nav>
      <main className="flex-1 px-4 md:px-10 py-6 md:py-10 max-w-5xl">{children}</main>
    </div>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="px-3 py-2 rounded-tape text-muted hover:text-paper hover:bg-tape transition-colors"
    >
      {children}
    </Link>
  );
}