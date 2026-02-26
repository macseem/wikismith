import { sql } from 'drizzle-orm';

const DEFAULT_PUBLIC_WIKI_REQUEST_LIMIT_PER_MINUTE = 120;
const PUBLIC_WIKI_ROUTE_KEY = 'wiki_public_share';

interface PublicRequestRateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

const getPublicWikiRequestLimit = (): number => {
  const configured = Number.parseInt(process.env['PUBLIC_WIKI_REQUEST_LIMIT_PER_MINUTE'] ?? '', 10);
  if (!Number.isFinite(configured) || configured <= 0) {
    return DEFAULT_PUBLIC_WIKI_REQUEST_LIMIT_PER_MINUTE;
  }

  return configured;
};

const getCurrentMinuteBucketStart = (): Date => {
  const now = new Date();
  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      now.getUTCHours(),
      now.getUTCMinutes(),
      0,
      0,
    ),
  );
};

const getSecondsUntilNextMinute = (): number => {
  const now = Date.now();
  return Math.max(1, Math.ceil((60_000 - (now % 60_000)) / 1000));
};

export const incrementPublicWikiRequestCount = async (
  requestKey: string,
): Promise<PublicRequestRateLimitResult> => {
  const { db, publicRequestRateLimits } = await import('@wikismith/db');

  const limit = getPublicWikiRequestLimit();
  const now = new Date();
  const bucketStart = getCurrentMinuteBucketStart();

  let counter;

  try {
    [counter] = await db
      .insert(publicRequestRateLimits)
      .values({
        requestKey,
        route: PUBLIC_WIKI_ROUTE_KEY,
        bucketStart,
        count: 1,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [
          publicRequestRateLimits.requestKey,
          publicRequestRateLimits.route,
          publicRequestRateLimits.bucketStart,
        ],
        set: {
          count: sql`${publicRequestRateLimits.count} + 1`,
          updatedAt: now,
        },
        setWhere: sql`${publicRequestRateLimits.count} < ${limit}`,
      })
      .returning({ count: publicRequestRateLimits.count });
  } catch (error) {
    const code =
      typeof error === 'object' && error && 'code' in error ? String(error.code) : undefined;

    if (code === '42P01') {
      return {
        allowed: true,
        retryAfterSeconds: getSecondsUntilNextMinute(),
      };
    }

    throw error;
  }

  if (!counter) {
    return {
      allowed: false,
      retryAfterSeconds: getSecondsUntilNextMinute(),
    };
  }

  return {
    allowed: true,
    retryAfterSeconds: getSecondsUntilNextMinute(),
  };
};
