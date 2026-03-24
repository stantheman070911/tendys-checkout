type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const globalForRateLimit = globalThis as typeof globalThis & {
  __rateLimitStore?: Map<string, RateLimitEntry>;
};

function getStore() {
  if (!globalForRateLimit.__rateLimitStore) {
    globalForRateLimit.__rateLimitStore = new Map<string, RateLimitEntry>();
  }
  return globalForRateLimit.__rateLimitStore;
}

function cleanupExpiredEntries(now: number) {
  const store = getStore();
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt <= now) {
      store.delete(key);
    }
  }
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

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { allowed: boolean; retryAfterSeconds: number } {
  if (process.env.NODE_ENV === "test") {
    return { allowed: true, retryAfterSeconds: 0 };
  }

  const now = Date.now();
  cleanupExpiredEntries(now);

  const store = getStore();
  const existing = store.get(key);
  if (!existing || existing.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (existing.count >= limit) {
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
