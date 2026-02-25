import { and, eq, sql } from 'drizzle-orm';
import { RateLimitError } from '@wikismith/shared';
import { getStoredUserByWorkOSId } from './user-store';

type DbModule = typeof import('@wikismith/db');

const loadDb = async (): Promise<DbModule> => {
  try {
    return await import('@wikismith/db');
  } catch (error) {
    throw new RateLimitError(
      'Failed to load database module for rate limiting.',
      'RATE_LIMIT_DB_LOAD',
      500,
      {
        cause: error,
      },
    );
  }
};

export interface RateLimitResult {
  allowed: boolean;
  used: number;
  limit: number;
  retryAfterSeconds: number;
  resetAt: string;
}

export interface DailyGenerationUsage {
  used: number;
  limit: number;
  resetAt: string;
}

const DEFAULT_DAILY_LIMIT = 5;

const getDailyGenerationLimit = (): number => {
  const configured = Number.parseInt(process.env['DAILY_WIKI_GENERATION_LIMIT'] ?? '', 10);
  if (!Number.isFinite(configured) || configured <= 0) {
    return DEFAULT_DAILY_LIMIT;
  }

  return configured;
};

const getCurrentBucketDate = (): string => new Date().toISOString().slice(0, 10);

const getSecondsUntilNextUtcDay = (): number => {
  const now = new Date();
  const tomorrow = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  );
  return Math.max(1, Math.ceil((tomorrow.getTime() - now.getTime()) / 1000));
};

const getNextUtcMidnightIso = (): string => {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  ).toISOString();
};

export const getDailyGenerationUsage = async (
  workosUserId: string,
): Promise<DailyGenerationUsage> => {
  const { db, generationRateLimits } = await loadDb();
  const user = await getStoredUserByWorkOSId(workosUserId);
  const dailyLimit = getDailyGenerationLimit();

  if (!user) {
    throw new RateLimitError(
      'Authenticated user record is missing.',
      'RATE_LIMIT_USER_MISSING',
      500,
    );
  }

  const bucketDate = getCurrentBucketDate();
  const row = await db.query.generationRateLimits.findFirst({
    where: and(
      eq(generationRateLimits.userId, user.id),
      eq(generationRateLimits.bucketDate, bucketDate),
    ),
    columns: {
      count: true,
    },
  });

  return {
    used: Math.min(row?.count ?? 0, dailyLimit),
    limit: dailyLimit,
    resetAt: getNextUtcMidnightIso(),
  };
};

export const incrementDailyGenerationCount = async (
  workosUserId: string,
): Promise<RateLimitResult> => {
  const { db, generationRateLimits } = await loadDb();

  let user;
  try {
    user = await getStoredUserByWorkOSId(workosUserId);
  } catch (error) {
    throw new RateLimitError(
      'Failed to load user for rate limiting.',
      'RATE_LIMIT_USER_LOAD',
      500,
      {
        cause: error,
      },
    );
  }

  if (!user) {
    throw new RateLimitError(
      'Authenticated user record is missing.',
      'RATE_LIMIT_USER_MISSING',
      500,
    );
  }

  const dailyLimit = getDailyGenerationLimit();
  const bucketDate = getCurrentBucketDate();
  const now = new Date();

  const [counter] = await db
    .insert(generationRateLimits)
    .values({
      userId: user.id,
      bucketDate,
      count: 1,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [generationRateLimits.userId, generationRateLimits.bucketDate],
      set: {
        count: sql`${generationRateLimits.count} + 1`,
        updatedAt: now,
      },
      setWhere: sql`${generationRateLimits.count} < ${dailyLimit}`,
    })
    .returning({ count: generationRateLimits.count });

  if (!counter) {
    return {
      allowed: false,
      used: dailyLimit,
      limit: dailyLimit,
      retryAfterSeconds: getSecondsUntilNextUtcDay(),
      resetAt: getNextUtcMidnightIso(),
    };
  }

  const used = counter.count;
  const retryAfterSeconds = getSecondsUntilNextUtcDay();

  return {
    allowed: true,
    used,
    limit: dailyLimit,
    retryAfterSeconds,
    resetAt: getNextUtcMidnightIso(),
  };
};
