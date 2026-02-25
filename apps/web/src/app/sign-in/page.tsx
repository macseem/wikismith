import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { getSession } from '@/lib/auth/session';
import { getGitHubSignInUrl } from '@/lib/auth/sign-in-url';

interface SignInPageProps {
  searchParams: Promise<{
    redirect?: string;
    reauth?: string;
    error?: string;
  }>;
}

const getSafeRedirectPath = (redirectPath?: string): string => {
  if (!redirectPath || !redirectPath.startsWith('/') || redirectPath.startsWith('//')) {
    return '/dashboard';
  }

  return redirectPath;
};

const SignInPage = async ({ searchParams }: SignInPageProps) => {
  const params = await searchParams;
  const session = await getSession();
  const returnPathname = getSafeRedirectPath(params.redirect);

  if (session) {
    redirect(returnPathname);
  }

  const requiresConsent = params.reauth === 'github_scope';
  const signInUrl = getGitHubSignInUrl({
    returnPathname,
    promptConsent: requiresConsent,
    state: requiresConsent ? 'github_scope' : undefined,
  });

  return (
    <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center px-6">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/70 p-8 space-y-6">
        <div className="space-y-2 text-center">
          <p className="text-zinc-400 text-sm">Welcome to WikiSmith</p>
          <h1 className="text-3xl font-bold tracking-tight">Sign in</h1>
          <p className="text-zinc-400 text-sm">
            Use your account to access repositories and generate wiki docs.
          </p>
        </div>

        {params.error === 'auth_failed' && (
          <p className="text-sm text-red-400 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2">
            Authentication failed. Please try signing in again.
          </p>
        )}

        {requiresConsent && (
          <p className="text-sm text-amber-300 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2">
            We need refreshed GitHub permissions to continue. Continue and approve requested repo
            access.
          </p>
        )}

        <Button asChild size="lg" className="w-full">
          <Link href={signInUrl}>Continue</Link>
        </Button>

        <p className="text-xs text-zinc-500 text-center">
          By continuing, you authorize WikiSmith to access repositories according to your configured
          provider scopes.
        </p>
      </div>
    </main>
  );
};

export default SignInPage;
