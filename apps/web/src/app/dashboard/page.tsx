import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AlertTriangle, Clock3, ExternalLink, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RepoInput } from '@/components/home/repo-input';
import { getSession } from '@/lib/auth/session';
import { getStoredUserByWorkOSId } from '@/lib/auth/user-store';
import { getDailyGenerationUsage } from '@/lib/auth/rate-limit';
import { listRecentWikis } from '@/lib/wiki-store';

const formatResetTime = (iso: string): string =>
  new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const shortSha = (sha: string): string => sha.slice(0, 7);

const DashboardPage = async () => {
  const session = await getSession();
  if (!session) {
    redirect('/sign-in?redirect=/dashboard');
  }

  const [dbUser, dailyUsage] = await Promise.all([
    getStoredUserByWorkOSId(session.user.workosId),
    getDailyGenerationUsage(session.user.workosId).catch(() => ({
      used: 0,
      limit: 5,
      resetAt: '',
    })),
  ]);

  const recentWikis = listRecentWikis({
    limit: 6,
    workosUserId: session.user.workosId,
  });
  const hasGitHubToken = Boolean(
    dbUser?.githubTokenEncrypted && dbUser.githubTokenIv && dbUser.githubTokenTag,
  );
  const usagePercent = Math.min(100, Math.round((dailyUsage.used / dailyUsage.limit) * 100));

  return (
    <main className="min-h-screen bg-zinc-950 text-white px-6 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-zinc-400">
              Signed in as <span className="text-zinc-100 font-medium">{session.user.email}</span>
            </p>
          </div>

          <div className="flex gap-2">
            <Button asChild size="sm" variant="secondary">
              <Link href="/settings">Settings</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/account">Account</Link>
            </Button>
          </div>
        </header>

        <Card className="p-5 bg-zinc-900/70 border-zinc-800 space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Generate a wiki</h2>
            <p className="text-sm text-zinc-400 mt-1">
              Paste a repository URL and start generation immediately.
            </p>
          </div>
          <RepoInput />
        </Card>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="p-5 bg-zinc-900/70 border-zinc-800 space-y-4">
            <div className="flex items-center gap-2">
              <Clock3 className="size-4 text-zinc-400" />
              <h2 className="text-lg font-semibold">Daily quota</h2>
            </div>
            <p className="text-sm text-zinc-400">
              {dailyUsage.used}/{dailyUsage.limit} generations used today
            </p>
            <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
              <div className="h-full bg-blue-500" style={{ width: `${usagePercent}%` }} />
            </div>
            <p className="text-xs text-zinc-500">
              Resets at {dailyUsage.resetAt ? formatResetTime(dailyUsage.resetAt) : 'unknown'}
            </p>
          </Card>

          <Card className="p-5 bg-zinc-900/70 border-zinc-800 space-y-4">
            <div className="flex items-center gap-2">
              {hasGitHubToken ? (
                <ShieldCheck className="size-4 text-emerald-400" />
              ) : (
                <AlertTriangle className="size-4 text-amber-400" />
              )}
              <h2 className="text-lg font-semibold">Authorization</h2>
            </div>
            <Badge variant={hasGitHubToken ? 'secondary' : 'outline'}>
              {hasGitHubToken ? 'Provider access configured' : 'Provider scopes missing'}
            </Badge>
            <p className="text-sm text-zinc-400 mt-1">
              {hasGitHubToken
                ? 'You can generate wikis for repositories allowed by your provider scopes.'
                : 'Reconnect to grant repository scopes needed for private repositories.'}
            </p>
            {!hasGitHubToken && (
              <Button asChild size="sm" variant="outline">
                <Link href="/sign-in?redirect=/dashboard&reauth=github_scope">Reconnect</Link>
              </Button>
            )}
          </Card>

          <Card className="p-5 bg-zinc-900/70 border-zinc-800 space-y-4">
            <h2 className="text-lg font-semibold">Recent generations</h2>
            {recentWikis.length === 0 ? (
              <p className="text-sm text-zinc-500">
                No generated wikis yet. Generate your first one above.
              </p>
            ) : (
              <div className="space-y-2">
                {recentWikis.map((wiki) => (
                  <Link
                    key={`${wiki.owner}/${wiki.repo}/${wiki.commitSha}`}
                    href={`/wiki/${wiki.owner}/${wiki.repo}`}
                    className="flex items-center justify-between rounded-md border border-zinc-800 px-3 py-2 text-sm hover:border-zinc-700"
                  >
                    <span className="truncate text-zinc-200">
                      {wiki.owner}/{wiki.repo}
                    </span>
                    <span className="flex items-center gap-2 text-xs text-zinc-500">
                      {shortSha(wiki.commitSha)}
                      <ExternalLink className="size-3" />
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </main>
  );
};

export default DashboardPage;
