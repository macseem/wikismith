import { NextResponse } from 'next/server';
import { AppError } from '@wikismith/shared';
import { getSession } from '@/lib/auth/session';
import { deleteRepositoryWiki } from '@/lib/repos/repository-service';

export const DELETE = async (
  _request: Request,
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

  try {
    const result = await deleteRepositoryWiki(session.user.workosId, owner, repo);
    return NextResponse.json({ ok: true, removedFromCache: result.removedFromCache });
  } catch (error) {
    if (error instanceof AppError) {
      const needsReconnect =
        error.code === 'MISSING_GITHUB_SCOPE' ||
        error.code === 'MISSING_GITHUB_TOKEN' ||
        error.code === 'GITHUB_SSO_AUTH_REQUIRED' ||
        error.code === 'UNAUTHENTICATED';

      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          reauthPath: needsReconnect
            ? '/sign-in?redirect=%2Fdashboard&reauth=github_scope'
            : undefined,
        },
        { status: error.statusCode },
      );
    }

    return NextResponse.json({ error: 'Failed to delete wiki' }, { status: 500 });
  }
};
