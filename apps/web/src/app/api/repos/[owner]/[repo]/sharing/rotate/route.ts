import { NextResponse } from 'next/server';
import { AppError } from '@wikismith/shared';
import { apiContracts } from '@wikismith/contracts';
import { getSession } from '@/lib/auth/session';
import { rotateRepositoryShareToken } from '@/lib/repos/repository-service';

interface SchemaParser<T> {
  parse: (value: unknown) => T;
}

const jsonResponse = <T>(schema: SchemaParser<T>, payload: unknown, init?: ResponseInit) =>
  NextResponse.json(schema.parse(payload), init);

export const POST = async (
  _request: Request,
  { params }: { params: Promise<{ owner: string; repo: string }> },
) => {
  const session = await getSession();
  if (!session) {
    return jsonResponse(
      apiContracts.repos.sharing.rotate.error,
      {
        error: 'Authentication required',
        code: 'UNAUTHENTICATED',
        signInPath: '/sign-in?redirect=%2Fdashboard',
      },
      { status: 401 },
    );
  }

  const parsedParams = apiContracts.repos.sharing.rotate.params.safeParse(await params);
  if (!parsedParams.success) {
    return jsonResponse(
      apiContracts.repos.sharing.rotate.error,
      {
        error: 'Invalid repository route params',
        code: 'INVALID_PARAMS',
      },
      { status: 400 },
    );
  }

  try {
    const settings = await rotateRepositoryShareToken(
      session.user.workosId,
      parsedParams.data.owner,
      parsedParams.data.repo,
    );

    return jsonResponse(apiContracts.repos.sharing.rotate.response, settings);
  } catch (error) {
    if (error instanceof AppError) {
      return jsonResponse(
        apiContracts.repos.sharing.rotate.error,
        {
          error: error.message,
          code: error.code,
        },
        { status: error.statusCode },
      );
    }

    return jsonResponse(
      apiContracts.repos.sharing.rotate.error,
      {
        error: 'Failed to rotate sharing link',
        code: 'SHARING_ROTATE_FAILED',
      },
      { status: 500 },
    );
  }
};
