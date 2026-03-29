import { Redis } from "@upstash/redis";
import { getRateLimitConfig, isProductionEnvironment } from "@/lib/server-env";

interface MemoryEntry {
  value: unknown;
  expiresAt: number | null;
}

export interface KeyValueStore {
  get<T = string>(key: string): Promise<T | null>;
  set(
    key: string,
    value: unknown,
    options?: {
      ex?: number;
    },
  ): Promise<void>;
  del(key: string): Promise<number>;
  ping(): Promise<string>;
}

const globalForUpstash = globalThis as typeof globalThis & {
  __keyValueStore?: KeyValueStore;
};

class MemoryKeyValueStore implements KeyValueStore {
  private readonly store = new Map<string, MemoryEntry>();

  private cleanup() {
    const now = Date.now();

    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt && entry.expiresAt <= now) {
        this.store.delete(key);
      }
    }
  }

  async get<T = string>(key: string): Promise<T | null> {
    this.cleanup();
    const entry = this.store.get(key);
    return (entry?.value as T | undefined) ?? null;
  }

  async set(key: string, value: unknown, options?: { ex?: number }) {
    this.cleanup();
    const expiresAt = options?.ex ? Date.now() + options.ex * 1000 : null;
    this.store.set(key, { value, expiresAt });
  }

  async del(key: string) {
    this.cleanup();
    const existed = this.store.delete(key);
    return existed ? 1 : 0;
  }

  async ping() {
    return "PONG";
  }
}

class UpstashKeyValueStore implements KeyValueStore {
  constructor(private readonly redis: Redis) {}

  async get<T = string>(key: string): Promise<T | null> {
    return this.redis.get<T>(key);
  }

  async set(key: string, value: unknown, options?: { ex?: number }) {
    const redisOptions = options?.ex ? { ex: options.ex as number } : undefined;
    await this.redis.set(key, value, redisOptions);
  }

  async del(key: string) {
    return this.redis.del(key);
  }

  async ping() {
    return this.redis.ping();
  }
}

function createKeyValueStore() {
  const config = getRateLimitConfig();

  if (config.url && config.token) {
    return new UpstashKeyValueStore(
      new Redis({
        url: config.url,
        token: config.token,
      }),
    );
  }

  if (!isProductionEnvironment()) {
    return new MemoryKeyValueStore();
  }

  throw new Error("Upstash Redis is required in production");
}

export function getKeyValueStore() {
  if (!globalForUpstash.__keyValueStore) {
    globalForUpstash.__keyValueStore = createKeyValueStore();
  }

  return globalForUpstash.__keyValueStore;
}

export async function checkRedisHealth() {
  try {
    const pong = await getKeyValueStore().ping();
    return { ok: pong === "PONG", error: pong === "PONG" ? null : pong };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown Redis error",
    };
  }
}
