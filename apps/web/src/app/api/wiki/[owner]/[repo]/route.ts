import { NextResponse } from 'next/server';
import { apiContracts } from '@wikismith/contracts';
import { getSession } from '@/lib/auth/session';
import { getWiki } from '@/lib/wiki-store';

interface SchemaParser<T> {
  parse: (value: unknown) => T;
}

const jsonResponse = <T>(schema: SchemaParser<T>, payload: unknown, init?: ResponseInit) =>
  NextResponse.json(schema.parse(payload), init);

export const GET = async (
  _request: Request,
  { params }: { params: Promise<{ owner: string; repo: string }> },
) => {
  const parsedParams = apiContracts.wiki.get.params.safeParse(await params);
  if (!parsedParams.success) {
    return jsonResponse(
      apiContracts.wiki.get.error,
      {
        error: 'Invalid wiki route parameters',
        code: 'INVALID_PARAMS',
      },
      { status: 400 },
    );
  }

  const { owner, repo } = parsedParams.data;
  const session = await getSession().catch(() => null);
  const wiki = await getWiki(owner, repo, session?.user.workosId);

  if (!wiki) {
    return jsonResponse(apiContracts.wiki.get.error, { error: 'Wiki not found' }, { status: 404 });
  }

  return jsonResponse(apiContracts.wiki.get.response, wiki);
};
