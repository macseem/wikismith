import { NextResponse } from 'next/server';
import { apiContracts } from '@wikismith/contracts';
import { incrementPublicWikiRequestCount } from '@/lib/public-request-rate-limit';
import { getPublicWikiByShareToken } from '@/lib/wiki-store';

const getRequesterKey = (request: Request): string | null => {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const firstHop = forwardedFor.split(',')[0]?.trim();
    if (firstHop) {
      return firstHop;
    }
  }

  const realIp = request.headers.get('x-real-ip')?.trim();
  if (realIp) {
    return realIp;
  }

  return null;
};

interface SchemaParser<T> {
  parse: (value: unknown) => T;
}

const jsonResponse = <T>(schema: SchemaParser<T>, payload: unknown, init?: ResponseInit) =>
  NextResponse.json(schema.parse(payload), init);

export const GET = async (
  request: Request,
  { params }: { params: Promise<{ shareToken: string }> },
) => {
  const requesterKey = getRequesterKey(request);
  if (requesterKey) {
    const rateLimit = await incrementPublicWikiRequestCount(requesterKey);
    if (!rateLimit.allowed) {
      return jsonResponse(
        apiContracts.wiki.public.getByShareToken.error,
        {
          error: 'Too many requests',
          code: 'RATE_LIMITED',
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateLimit.retryAfterSeconds),
          },
        },
      );
    }
  }

  const parsedParams = apiContracts.wiki.public.getByShareToken.params.safeParse(await params);
  if (!parsedParams.success) {
    return jsonResponse(
      apiContracts.wiki.public.getByShareToken.error,
      {
        error: 'Invalid share token',
        code: 'INVALID_SHARE_TOKEN',
      },
      { status: 400 },
    );
  }

  const wiki = await getPublicWikiByShareToken(parsedParams.data.shareToken);
  if (!wiki) {
    return jsonResponse(
      apiContracts.wiki.public.getByShareToken.error,
      {
        error: 'Wiki not found',
        code: 'WIKI_NOT_FOUND',
      },
      { status: 404 },
    );
  }

  return jsonResponse(apiContracts.wiki.public.getByShareToken.response, wiki);
};
