import Link from 'next/link';
import { signOut } from '@workos-inc/authkit-nextjs';
import { Button } from '@/components/ui/button';
import type { AppSession } from '@/lib/auth/session';
import { getGitHubSignInUrl } from '@/lib/auth/sign-in-url';

interface AuthNavProps {
  session: AppSession | null;
  returnPathname?: string;
  className?: string;
}

export const AuthNav = ({ session, returnPathname = '/dashboard', className }: AuthNavProps) => {
  if (!session) {
    let signInUrl = '/sign-in';
    try {
      signInUrl = getGitHubSignInUrl({ returnPathname });
    } catch {
      signInUrl = '/sign-in';
    }

    return (
      <Button asChild size="sm" className={className}>
        <Link href={signInUrl}>Sign in</Link>
      </Button>
    );
  }

  return (
    <div className={className ? `flex items-center gap-2 ${className}` : 'flex items-center gap-2'}>
      <Button asChild size="sm" variant="secondary">
        <Link href="/dashboard">Dashboard</Link>
      </Button>
      <form
        action={async () => {
          'use server';
          await signOut({ returnTo: '/' });
        }}
      >
        <Button type="submit" size="sm" variant="outline">
          Sign out
        </Button>
      </form>
    </div>
  );
};
