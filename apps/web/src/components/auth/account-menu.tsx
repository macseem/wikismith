import Link from 'next/link';
import { signOut } from '@workos-inc/authkit-nextjs';
import { ChevronDown, UserRound } from 'lucide-react';
import type { AppSession } from '@/lib/auth/session';
import { cn } from '@/lib/utils';

interface AccountMenuProps {
  session: AppSession;
  className?: string;
}

export const AccountMenu = ({ session, className }: AccountMenuProps) => (
  <details className={cn('relative', className)}>
    <summary
      aria-label="Account menu"
      className="flex cursor-pointer list-none items-center gap-2 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 transition-colors hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 [&::-webkit-details-marker]:hidden"
    >
      <UserRound className="h-4 w-4 text-zinc-400" />
      <span className="hidden sm:inline">Account</span>
      <ChevronDown className="h-4 w-4 text-zinc-400" />
    </summary>

    <div className="absolute right-0 z-20 mt-2 w-64 rounded-md border border-zinc-700 bg-zinc-900 p-2 shadow-xl">
      <div className="border-b border-zinc-800 px-2 py-2">
        <p className="text-xs uppercase tracking-wide text-zinc-500">Signed in</p>
        <p className="truncate text-sm text-zinc-200">{session.user.email}</p>
      </div>

      <div className="space-y-1 p-2">
        <Link
          href="/dashboard"
          className="block rounded-md px-2 py-1.5 text-sm text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70"
        >
          Dashboard
        </Link>
        <Link
          href="/settings"
          className="block rounded-md px-2 py-1.5 text-sm text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70"
        >
          Settings
        </Link>
      </div>

      <div className="border-t border-zinc-800 p-2">
        <form
          action={async () => {
            'use server';
            await signOut({ returnTo: '/' });
          }}
        >
          <button
            type="submit"
            className="w-full rounded-md px-2 py-1.5 text-left text-sm text-red-300 transition-colors hover:bg-zinc-800 hover:text-red-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/80"
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  </details>
);
