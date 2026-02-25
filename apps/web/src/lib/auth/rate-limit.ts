import { db, generationRateLimits } from '@wikismith/db';
import { sql } from 'drizzle-orm';
import { getStoredUserByWorkOSId } from './user-store';

export interface RateLimitResult {
  allowed: boolean;
  used: number;
  limit: number;
  retryAfterSeconds: number;
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

export const incrementDailyGenerationCount = async (
  workosUserId: string,
): Promise<RateLimitResult> => {
  let user;
  try {
    user = await getStoredUserByWorkOSId(workosUserId);
  } catch (error) {
    throw new Error('Failed to load user for rate limiting.', { cause: error });
  }

  if (!user) {
    throw new Error('Authenticated user record is missing.');
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
