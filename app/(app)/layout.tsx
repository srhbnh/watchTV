import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import SignOutButton from './sign-out-button';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <nav className="border-b md:border-b-0 md:border-r border-ribbon md:w-56 md:min-h-screen flex md:flex-col justify-between px-4 md:px-6 py-4 md:py-8">
        <div>
          <Link href="/dashboard" className="font-display text-xl block mb-8">
            WatchNext
          </Link>
          <div className="flex md:flex-col gap-1 text-sm">
            <NavLink href="/dashboard">À voir</NavLink>
            <NavLink href="/library">Bibliothèque</NavLink>
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
