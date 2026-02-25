import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getSession } from '@/lib/auth/session';
import { getStoredUserByWorkOSId } from '@/lib/auth/user-store';

const DashboardPage = async () => {
  const session = await getSession();
  if (!session) {
    redirect('/sign-in?redirect=/dashboard');
  }

  const dbUser = await getStoredUserByWorkOSId(session.user.workosId);
  const hasGitHubToken = Boolean(
    dbUser?.githubTokenEncrypted && dbUser.githubTokenIv && dbUser.githubTokenTag,
  );

  return (
    <main className="min-h-screen bg-zinc-950 text-white px-6 py-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-zinc-400">
            Signed in as <span className="text-zinc-100 font-medium">{session.user.email}</span>
          </p>
        </header>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="p-5 bg-zinc-900/70 border-zinc-800">
            <h2 className="text-lg font-semibold">Authentication</h2>
            <p className="text-sm text-zinc-400 mt-1">
              Your WorkOS session is active and routes are protected by middleware.
            </p>
            <Badge className="mt-4" variant={hasGitHubToken ? 'secondary' : 'outline'}>
              {hasGitHubToken ? 'GitHub OAuth connected' : 'GitHub OAuth missing scopes'}
            </Badge>
            {!hasGitHubToken && (
              <p className="text-xs text-zinc-500 mt-2">
                Re-authenticate to grant repository scopes for private repo generation.
              </p>
            )}
            {!hasGitHubToken && (
              <Button asChild size="sm" variant="outline" className="mt-3">
                <Link href="/sign-in?redirect=/dashboard&reauth=github_scope">
                  Reconnect GitHub
                </Link>
              </Button>
            )}
          </Card>

          <Card className="p-5 bg-zinc-900/70 border-zinc-800">
            <h2 className="text-lg font-semibold">Account</h2>
            <p className="text-sm text-zinc-400 mt-1">
              Manage session settings and permanently delete your data.
            </p>
            <div className="mt-4 flex gap-2">
              <Button asChild size="sm" variant="secondary">
                <Link href="/settings">Settings</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href="/account">Account</Link>
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
};

export default DashboardPage;
