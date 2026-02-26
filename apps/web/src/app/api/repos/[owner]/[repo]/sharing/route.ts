import { NextResponse } from 'next/server';
import { AppError } from '@wikismith/shared';
import { apiContracts } from '@wikismith/contracts';
import { getSession } from '@/lib/auth/session';
import {
  getRepositorySharingSettings,
  updateRepositorySharingSettings,
} from '@/lib/repos/repository-service';

interface SchemaParser<T> {
  parse: (value: unknown) => T;
}

const jsonResponse = <T>(schema: SchemaParser<T>, payload: unknown, init?: ResponseInit) =>
  NextResponse.json(schema.parse(payload), init);

const unauthenticated = () =>
  jsonResponse(
    apiContracts.repos.sharing.get.error,
    {
      error: 'Authentication required',
      code: 'UNAUTHENTICATED',
      signInPath: '/sign-in?redirect=%2Fdashboard',
    },
    { status: 401 },
  );

const parseParams = async (params: Promise<{ owner: string; repo: string }>) => {
  const parsed = apiContracts.repos.sharing.get.params.safeParse(await params);
  if (!parsed.success) {
    return null;
  }

  return parsed.data;
};

export const GET = async (
  _request: Request,
  { params }: { params: Promise<{ owner: string; repo: string }> },
) => {
  const session = await getSession();
  if (!session) {
    return unauthenticated();
  }

  const parsedParams = await parseParams(params);
  if (!parsedParams) {
    return jsonResponse(
      apiContracts.repos.sharing.get.error,
      {
        error: 'Invalid repository route params',
        code: 'INVALID_PARAMS',
      },
      { status: 400 },
    );
  }

  try {
    const settings = await getRepositorySharingSettings(
      session.user.workosId,
      parsedParams.owner,
      parsedParams.repo,
    );

    return jsonResponse(apiContracts.repos.sharing.get.response, settings);
  } catch (error) {
    if (error instanceof AppError) {
      return jsonResponse(
        apiContracts.repos.sharing.get.error,
        {
          error: error.message,
          code: error.code,
        },
        { status: error.statusCode },
      );
    }

    return jsonResponse(
      apiContracts.repos.sharing.get.error,
      {
        error: 'Failed to load sharing settings',
        code: 'SHARING_LOAD_FAILED',
      },
      { status: 500 },
    );
  }
};

export const PATCH = async (
  request: Request,
  { params }: { params: Promise<{ owner: string; repo: string }> },
) => {
  const session = await getSession();
  if (!session) {
    return unauthenticated();
  }

  const parsedParams = await parseParams(params);
  if (!parsedParams) {
    return jsonResponse(
      apiContracts.repos.sharing.update.error,
      {
        error: 'Invalid repository route params',
        code: 'INVALID_PARAMS',
      },
      { status: 400 },
    );
  }

  let rawBody: unknown;
  try {
    rawBody = (await request.json()) as unknown;
  } catch {
    return jsonResponse(
      apiContracts.repos.sharing.update.error,
      {
        error: 'Invalid JSON body',
        code: 'INVALID_BODY',
      },
      { status: 400 },
    );
  }

  const bodyResult = apiContracts.repos.sharing.update.body.safeParse(rawBody);
  if (!bodyResult.success) {
    return jsonResponse(
      apiContracts.repos.sharing.update.error,
      {
        error: 'At least one sharing setting must be provided',
        code: 'INVALID_BODY',
      },
      { status: 400 },
    );
  }

  try {
    const settings = await updateRepositorySharingSettings(
      session.user.workosId,
      parsedParams.owner,
      parsedParams.repo,
      bodyResult.data.isPublic,
      bodyResult.data.embedEnabled,
    );

    return jsonResponse(apiContracts.repos.sharing.update.response, settings);
  } catch (error) {
    if (error instanceof AppError) {
      return jsonResponse(
        apiContracts.repos.sharing.update.error,
        {
          error: error.message,
          code: error.code,
        },
        { status: error.statusCode },
      );
    }

    return jsonResponse(
      apiContracts.repos.sharing.update.error,
      {
        error: 'Failed to update sharing settings',
        code: 'SHARING_UPDATE_FAILED',
      },
      { status: 500 },
    );
  }
};
