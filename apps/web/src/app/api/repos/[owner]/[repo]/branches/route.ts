import { NextResponse } from 'next/server';
import { AppError } from '@wikismith/shared';
import { getSession } from '@/lib/auth/session';
import { getRepositoryBranches } from '@/lib/repos/repository-service';

export const GET = async (
  request: Request,
  { params }: { params: Promise<{ owner: string; repo: string }> },
) => {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      {
        error: 'Authentication required',
        code: 'UNAUTHENTICATED',
        signInPath: '/sign-in?redirect=%2Fdashboard',
      },
      { status: 401 },
    );
  }

  let owner: string;
  let repo: string;
  try {
    ({ owner, repo } = await params);
  } catch {
    return NextResponse.json({ error: 'Invalid repository route params' }, { status: 400 });
  }
  const url = new URL(request.url);
  const refresh = url.searchParams.get('refresh') === '1';

  try {
    const branches = await getRepositoryBranches(session.user.workosId, owner, repo, refresh);
    return NextResponse.json({ branches });
  } catch (error) {
    if (error instanceof AppError) {
      const retryAfterSeconds =
        typeof error.details?.['retryAfterSeconds'] === 'number'
          ? error.details['retryAfterSeconds']
          : undefined;

      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          retryAfterSeconds,
          reauthPath:
            error.code === 'MISSING_GITHUB_SCOPE'
              ? '/sign-in?redirect=%2Fdashboard&reauth=github_scope'
              : undefined,
        },
        {
          status: error.statusCode,
          headers: retryAfterSeconds
            ? {
                'Retry-After': String(retryAfterSeconds),
              }
            : undefined,
        },
      );
    }

    return NextResponse.json({ error: 'Failed to load repository branches' }, { status: 500 });
  }
};
