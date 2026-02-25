import { NextResponse } from 'next/server';
import { AppError } from '@wikismith/shared';
import { getSession } from '@/lib/auth/session';
import { updateRepositorySettings } from '@/lib/repos/repository-service';

interface SettingsBody {
  trackedBranch?: string | null;
  autoUpdate?: boolean;
}

const isValidGitRefName = (value: string): boolean => {
  if (value.length === 0 || value.length > 255) {
    return false;
  }

  if (
    value.startsWith('/') ||
    value.endsWith('/') ||
    value.startsWith('.') ||
    value.endsWith('.')
  ) {
    return false;
  }

  if (value.includes('..') || value.includes('//') || value.includes('@{')) {
    return false;
  }

  return !/[~^:?*\[\]\\\s]/.test(value);
};

export const PATCH = async (
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

  let body: SettingsBody;
  try {
    body = (await request.json()) as SettingsBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body', code: 'INVALID_BODY' }, { status: 400 });
  }

  const hasTrackedBranch = Object.prototype.hasOwnProperty.call(body, 'trackedBranch');
  const hasAutoUpdate = Object.prototype.hasOwnProperty.call(body, 'autoUpdate');

  if (!hasTrackedBranch && !hasAutoUpdate) {
    return NextResponse.json(
      { error: 'At least one setting must be provided', code: 'NO_SETTINGS_PROVIDED' },
      { status: 400 },
    );
  }

  let trackedBranch: string | null | undefined;
  if (hasTrackedBranch) {
    if (typeof body.trackedBranch !== 'string' && body.trackedBranch !== null) {
      return NextResponse.json(
        { error: 'Invalid tracked branch value', code: 'INVALID_TRACKED_BRANCH' },
        { status: 400 },
      );
    }

    trackedBranch =
      typeof body.trackedBranch === 'string'
        ? body.trackedBranch.trim() || null
        : body.trackedBranch;
  }

  if (hasAutoUpdate && typeof body.autoUpdate !== 'boolean') {
    return NextResponse.json(
      { error: 'Invalid auto-update value', code: 'INVALID_AUTO_UPDATE' },
      { status: 400 },
    );
  }

  if (trackedBranch && !isValidGitRefName(trackedBranch)) {
    return NextResponse.json(
      { error: 'Invalid tracked branch name', code: 'INVALID_TRACKED_BRANCH' },
      { status: 400 },
    );
  }

  const autoUpdate = hasAutoUpdate ? body.autoUpdate : undefined;

  try {
    await updateRepositorySettings(session.user.workosId, owner, repo, trackedBranch, autoUpdate);
    return NextResponse.json({ ok: true });
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

    return NextResponse.json({ error: 'Failed to save repository settings' }, { status: 500 });
  }
};
