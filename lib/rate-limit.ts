import { Redis } from "@upstash/redis";
import {
  getRateLimitConfig,
  isEnvironmentConfigurationError,
} from "@/lib/server-env";

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const globalForRateLimit = globalThis as typeof globalThis & {
  __rateLimitStore?: RateLimitStore;
};

const incrementBucketScript = `
  local key = KEYS[1]
  local ttl_ms = tonumber(ARGV[1])
  local current = redis.call("INCR", key)
  if current == 1 then
    redis.call("PEXPIRE", key, ttl_ms)
  end
  local remaining = redis.call("PTTL", key)
  return { current, remaining }
`;

export interface CheckRateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
  error?: "backend_unavailable";
}

interface RateLimitCheckArgs {
  key: string;
  limit: number;
  windowMs: number;
}

interface RateLimitStore {
  check(args: RateLimitCheckArgs): Promise<CheckRateLimitResult>;
}

class MemoryRateLimitStore implements RateLimitStore {
  private readonly store = new Map<string, RateLimitEntry>();

  private cleanupExpiredEntries(now: number) {
    for (const [key, entry] of this.store.entries()) {
      if (entry.resetAt <= now) {
        this.store.delete(key);
      }
    }
  }

  async check(args: RateLimitCheckArgs): Promise<CheckRateLimitResult> {
    const now = Date.now();
    this.cleanupExpiredEntries(now);

    const existing = this.store.get(args.key);
    if (!existing || existing.resetAt <= now) {
      this.store.set(args.key, { count: 1, resetAt: now + args.windowMs });
      return { allowed: true, retryAfterSeconds: 0 };
    }

    if (existing.count >= args.limit) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((existing.resetAt - now) / 1000),
        ),
      };
    }

    existing.count += 1;
    return { allowed: true, retryAfterSeconds: 0 };
  }
}

class RedisRateLimitStore implements RateLimitStore {
  private readonly redis: Redis;
  private readonly prefix: string;
  private readonly incrementBucket;

  constructor() {
    const config = getRateLimitConfig();
    this.prefix = config.prefix;
    this.redis = new Redis({
      url: config.url!,
      token: config.token!,
    });
    this.incrementBucket =
      this.redis.createScript<[number, number]>(incrementBucketScript);
  }

  private buildBucketKey(key: string, bucket: number) {
    return `${this.prefix}:${key}:${bucket}`;
  }

  async check(args: RateLimitCheckArgs): Promise<CheckRateLimitResult> {
    const now = Date.now();
    const bucket = Math.floor(now / args.windowMs);
    const bucketEndsAt = (bucket + 1) * args.windowMs;
    const ttlMs = Math.max(1, bucketEndsAt - now);
    const bucketKey = this.buildBucketKey(args.key, bucket);

    const response = await this.incrementBucket.exec(
      [bucketKey],
      [String(ttlMs)],
    );

    const count = Number(response[0] ?? 0);
    const remainingMs = Number(response[1] ?? ttlMs);

    if (count > args.limit) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil(remainingMs / 1000)),
      };
    }

    return { allowed: true, retryAfterSeconds: 0 };
  }
}

function createRateLimitStore(): RateLimitStore {
  if (process.env.NODE_ENV === "test" || process.env.NODE_ENV === "development") {
    return new MemoryRateLimitStore();
  }

  return new RedisRateLimitStore();
}

function getStore() {
  if (!globalForRateLimit.__rateLimitStore) {
    globalForRateLimit.__rateLimitStore = createRateLimitStore();
  }

  return globalForRateLimit.__rateLimitStore;
}

export function resetRateLimitStoreForTests() {
  delete globalForRateLimit.__rateLimitStore;
}

export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim();
    if (firstIp) return firstIp;
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  return "unknown";
}

export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<CheckRateLimitResult> {
  try {
    return await getStore().check({ key, limit, windowMs });
  } catch (error) {
    if (isEnvironmentConfigurationError(error)) {
      return {
        allowed: false,
        retryAfterSeconds: 0,
        error: "backend_unavailable",
      };
    }

    throw error;
  }
}
