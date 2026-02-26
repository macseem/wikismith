import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AppError } from '@wikismith/shared';
import { AlertTriangle, Clock3, RefreshCcw, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { RepoInput } from '@/components/home/repo-input';
import { RepositoryCardActions } from '@/components/dashboard/repository-card-actions';
import { AccountMenu } from '@/components/auth/account-menu';
import { getSession } from '@/lib/auth/session';
import { getDailyGenerationUsage } from '@/lib/auth/rate-limit';
import { getRepositoryDashboardData, type WikiStatus } from '@/lib/repos/repository-service';

interface DashboardPageProps {
  searchParams: Promise<{
    q?: string;
    language?: string;
    status?: WikiStatus | 'all';
    cursor?: string;
    refresh?: string;
    authError?: 'missing_provider_tokens' | 'missing_repo_scope' | 'repo_scope_check_failed';
  }>;
}

const formatRelativeDate = (value: string): string => {
  const target = new Date(value).getTime();
  const delta = target - Date.now();
  const abs = Math.abs(delta);

  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (abs < hour) {
    const minutes = Math.max(1, Math.floor(abs / minute));
    return delta >= 0 ? `in ${minutes}m` : `${minutes}m ago`;
  }

  if (abs < day) {
    const hours = Math.max(1, Math.floor(abs / hour));
    return delta >= 0 ? `in ${hours}h` : `${hours}h ago`;
  }

  const days = Math.max(1, Math.floor(abs / day));
  return delta >= 0 ? `in ${days}d` : `${days}d ago`;
};

const STATUS_VARIANTS: Record<WikiStatus, 'secondary' | 'outline' | 'destructive'> = {
  not_generated: 'outline',
  generating: 'secondary',
  ready: 'secondary',
  failed: 'destructive',
};

const STATUS_LABELS: Record<WikiStatus, string> = {
  not_generated: 'Not generated',
  generating: 'Generating',
  ready: 'Ready',
  failed: 'Failed',
};

interface DashboardRepositoryLoadResult {
  error: AppError | null;
  items: Awaited<ReturnType<typeof getRepositoryDashboardData>>['items'];
  availableLanguages: Awaited<ReturnType<typeof getRepositoryDashboardData>>['availableLanguages'];
  pageInfo: Awaited<ReturnType<typeof getRepositoryDashboardData>>['pageInfo'];
}

const DashboardPage = async ({ searchParams }: DashboardPageProps) => {
  const session = await getSession();
  if (!session) {
    redirect('/sign-in?redirect=/dashboard');
  }

  const params = await searchParams;
  const query = params.q?.trim() ?? '';
  const languageFilter = params.language && params.language.length > 0 ? params.language : 'all';
  const statusFilter = params.status && params.status.length > 0 ? params.status : 'all';
  const cursor = params.cursor ?? null;
  const refresh = params.refresh === '1';
  const authError = params.authError;

  const [dailyUsage, dashboardResult] = await Promise.all([
    getDailyGenerationUsage(session.user.workosId).catch(() => ({
      used: 0,
      limit: 5,
      resetAt: '',
    })),
    getRepositoryDashboardData({
      workosUserId: session.user.workosId,
      query,
      language: languageFilter,
      status: statusFilter as WikiStatus | 'all',
      cursor,
      refresh,
    })
      .then(
        (result): DashboardRepositoryLoadResult => ({
          error: null,
          items: result.items,
          availableLanguages: result.availableLanguages,
          pageInfo: result.pageInfo,
        }),
      )
      .catch((error: unknown): DashboardRepositoryLoadResult => {
        if (error instanceof AppError) {
          return {
            error,
            items: [],
            availableLanguages: [],
            pageInfo: {
              previousCursor: null,
              nextCursor: null,
            },
          };
        }

        return {
          error: new AppError(
            'Failed to load repositories for dashboard.',
            'REPO_DASHBOARD_LOAD_ERROR',
            500,
          ),
          items: [],
          availableLanguages: [],
          pageInfo: {
            previousCursor: null,
            nextCursor: null,
          },
        };
      }),
  ]);

  const usagePercent = Math.min(100, Math.round((dailyUsage.used / dailyUsage.limit) * 100));
  const dashboardError = dashboardResult.error;
  const supportsReconnect =
    dashboardError?.code === 'MISSING_GITHUB_SCOPE' ||
    dashboardError?.code === 'MISSING_GITHUB_TOKEN' ||
    dashboardError?.code === 'GITHUB_SSO_AUTH_REQUIRED' ||
    dashboardError?.code === 'UNAUTHENTICATED';

  const queryParams = new URLSearchParams();
  if (query) {
    queryParams.set('q', query);
  }
  if (languageFilter !== 'all') {
    queryParams.set('language', languageFilter);
  }
  if (statusFilter !== 'all') {
    queryParams.set('status', statusFilter);
  }

  const previousHref = dashboardResult.pageInfo.previousCursor
    ? `/dashboard?${new URLSearchParams({
        ...Object.fromEntries(queryParams.entries()),
        cursor: dashboardResult.pageInfo.previousCursor,
      }).toString()}`
    : null;

  const nextHref = dashboardResult.pageInfo.nextCursor
    ? `/dashboard?${new URLSearchParams({
        ...Object.fromEntries(queryParams.entries()),
        cursor: dashboardResult.pageInfo.nextCursor,
      }).toString()}`
    : null;

  const refreshHref = `/dashboard?${new URLSearchParams({
    ...Object.fromEntries(queryParams.entries()),
    refresh: '1',
  }).toString()}`;

  return (
    <main className="min-h-screen bg-zinc-950 text-white px-6 py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Repository Dashboard</h1>
            <p className="text-zinc-400">
              Signed in as <span className="text-zinc-100 font-medium">{session.user.email}</span>
            </p>
          </div>

          <AccountMenu session={session} />
        </header>

        <Card className="p-5 bg-zinc-900/70 border-zinc-800 space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Generate by URL</h2>
            <p className="text-sm text-zinc-400 mt-1">
              Paste any repository URL, including public repositories outside your list.
            </p>
          </div>
          <RepoInput />
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
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
              Resets {dailyUsage.resetAt ? formatRelativeDate(dailyUsage.resetAt) : 'soon'}
            </p>
          </Card>

          <Card className="p-5 bg-zinc-900/70 border-zinc-800 space-y-3">
            <div className="flex items-center gap-2">
              <Search className="size-4 text-zinc-400" />
              <h2 className="text-lg font-semibold">Repository controls</h2>
            </div>
            <p className="text-sm text-zinc-400">
              Search and filter your GitHub repositories. Refresh pulls the latest list from GitHub.
            </p>
            <Button asChild size="sm" variant="outline">
              <Link href={refreshHref}>
                <RefreshCcw className="size-4" />
                Refresh from GitHub
              </Link>
            </Button>
          </Card>
        </div>

        <Card className="p-5 bg-zinc-900/70 border-zinc-800 space-y-5">
          <form
            className="grid gap-3 md:grid-cols-[1.5fr_1fr_1fr_auto]"
            method="GET"
            action="/dashboard"
          >
            <Input
              name="q"
              defaultValue={query}
              placeholder="Search by name or owner"
              className="bg-zinc-950 border-zinc-700"
            />

            <select
              name="language"
              defaultValue={languageFilter}
              className="h-10 rounded-md border border-zinc-700 bg-zinc-950 px-3 text-sm"
            >
              <option value="all">All languages</option>
              {dashboardResult.availableLanguages.map((language) => (
                <option key={language} value={language}>
                  {language}
                </option>
              ))}
            </select>

            <select
              name="status"
              defaultValue={statusFilter}
              className="h-10 rounded-md border border-zinc-700 bg-zinc-950 px-3 text-sm"
            >
              <option value="all">All statuses</option>
              <option value="not_generated">Not generated</option>
              <option value="generating">Generating</option>
              <option value="ready">Ready</option>
              <option value="failed">Failed</option>
            </select>

            <Button type="submit" size="sm">
              Apply
            </Button>
          </form>

          {supportsReconnect && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">
              {dashboardError?.code === 'MISSING_GITHUB_TOKEN' ? (
                <p>
                  GitHub provider token is missing for your session. Reconnect account and ensure
                  WorkOS GitHub connection is configured to return OAuth tokens.
                </p>
              ) : dashboardError?.code === 'UNAUTHENTICATED' ? (
                <p>
                  GitHub authorization expired or is invalid. Reconnect account to restore
                  repository access.
                </p>
              ) : dashboardError?.code === 'GITHUB_SSO_AUTH_REQUIRED' ? (
                <p>
                  GitHub organization SSO authorization is required for one or more repositories.
                  Authorize your token for the org, then reconnect account.
                </p>
              ) : (
                <p>
                  Repository scopes are missing. Re-authenticate to load private and collaborator
                  repositories.
                </p>
              )}

              {dashboardError?.message && (
                <p className="mt-2 text-xs text-amber-200/80">Details: {dashboardError.message}</p>
              )}

              <Button asChild size="sm" variant="outline" className="mt-3">
                <Link href="/sign-in?redirect=/dashboard&reauth=github_scope">
                  Reconnect account
                </Link>
              </Button>
            </div>
          )}

          {authError === 'missing_provider_tokens' && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200 space-y-2">
              <p>
                WorkOS authentication succeeded, but GitHub provider tokens were not returned.
                Update your WorkOS GitHub connection configuration to return OAuth tokens.
              </p>
              <p className="text-xs text-amber-300/80">
                After updating the connection, click reconnect again.
              </p>
              <Button asChild size="sm" variant="outline">
                <Link href="/sign-in?redirect=/dashboard&reauth=github_scope">
                  Reconnect account
                </Link>
              </Button>
            </div>
          )}

          {authError === 'missing_repo_scope' && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200 space-y-2">
              <p>
                GitHub sign-in completed, but repository scopes are still missing. Approve requested
                repository permissions and reconnect.
              </p>
              <Button asChild size="sm" variant="outline">
                <Link href="/sign-in?redirect=/dashboard&reauth=github_scope">
                  Reconnect account
                </Link>
              </Button>
            </div>
          )}

          {authError === 'repo_scope_check_failed' && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200 space-y-2">
              <p>
                We could not verify GitHub repository access right now due to a transient GitHub API
                failure. Please reconnect and try again.
              </p>
              <Button asChild size="sm" variant="outline">
                <Link href="/sign-in?redirect=/dashboard&reauth=github_scope">
                  Reconnect account
                </Link>
              </Button>
            </div>
          )}

          {dashboardError && !supportsReconnect && (
            <div className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200 flex items-center gap-2">
              <AlertTriangle className="size-4" />
              <span>{dashboardError.message}</span>
            </div>
          )}

          {dashboardResult.items.length === 0 && !dashboardError && (
            <p className="text-sm text-zinc-500">
              No repositories match this filter. Try clearing search filters or refresh from GitHub.
            </p>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            {dashboardResult.items.map((repo) => (
              <Card key={repo.fullName} className="p-4 bg-zinc-950/60 border-zinc-800 space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <a
                      href={`https://github.com/${repo.fullName}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-zinc-100 hover:underline"
                    >
                      {repo.fullName}
                    </a>

                    <Badge variant={STATUS_VARIANTS[repo.wikiStatus]}>
                      {STATUS_LABELS[repo.wikiStatus]}
                    </Badge>
                  </div>

                  <p className="text-sm text-zinc-400 line-clamp-2 min-h-10">
                    {repo.description ?? 'No description provided.'}
                  </p>

                  <div className="flex flex-wrap gap-2 text-xs text-zinc-500">
                    <span>{repo.language ?? 'Unknown'}</span>
                    <span>•</span>
                    <span>{repo.isPrivate ? 'Private' : 'Public'}</span>
                    <span>•</span>
                    <span>
                      {repo.lastPushedAt
                        ? `Updated ${formatRelativeDate(repo.lastPushedAt)}`
                        : 'Never pushed'}
                    </span>
                  </div>
                </div>

                <RepositoryCardActions
                  owner={repo.owner}
                  repo={repo.name}
                  fullName={repo.fullName}
                  defaultBranch={repo.defaultBranch}
                  trackedBranch={repo.trackedBranch}
                  autoUpdate={repo.autoUpdate}
                  initialStatus={repo.wikiStatus}
                />
              </Card>
            ))}
          </div>

          <div className="flex items-center justify-between pt-2">
            {previousHref ? (
              <Button asChild size="sm" variant="outline">
                <Link href={previousHref}>Previous</Link>
              </Button>
            ) : (
              <Button size="sm" variant="outline" disabled>
                Previous
              </Button>
            )}

            {nextHref ? (
              <Button asChild size="sm" variant="outline">
                <Link href={nextHref}>Next</Link>
              </Button>
            ) : (
              <Button size="sm" variant="outline" disabled>
                Next
              </Button>
            )}
          </div>
        </Card>
      </div>
    </main>
  );
};

export default DashboardPage;
