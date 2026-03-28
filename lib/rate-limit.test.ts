import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const execMock = vi.hoisted(() => vi.fn());
const redisConstructorMock = vi.hoisted(() => vi.fn());

vi.mock("@upstash/redis", () => ({
  Redis: redisConstructorMock.mockImplementation(() => ({
    createScript: () => ({
      exec: execMock,
    }),
  })),
}));

const ORIGINAL_ENV = { ...process.env };

async function importRateLimitModule() {
  return import("@/lib/rate-limit");
}

describe("checkRateLimit", () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-25T00:00:00.000Z"));
    process.env = { ...ORIGINAL_ENV };
    execMock.mockReset();
    redisConstructorMock.mockClear();
    const { resetRateLimitStoreForTests } = await importRateLimitModule();
    resetRateLimitStoreForTests();
  });

  afterEach(async () => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    process.env = { ...ORIGINAL_ENV };
    const { resetRateLimitStoreForTests } = await importRateLimitModule();
    resetRateLimitStoreForTests();
  });

  it("uses in-memory buckets in test and blocks after the limit", async () => {
    vi.stubEnv("NODE_ENV", "test");
    const { checkRateLimit } = await importRateLimitModule();

    expect(await checkRateLimit("lookup:1.2.3.4", 2, 1000)).toEqual({
      allowed: true,
      retryAfterSeconds: 0,
    });
    expect(await checkRateLimit("lookup:1.2.3.4", 2, 1000)).toEqual({
      allowed: true,
      retryAfterSeconds: 0,
    });
    expect(await checkRateLimit("lookup:1.2.3.4", 2, 1000)).toEqual({
      allowed: false,
      retryAfterSeconds: 1,
    });

    vi.setSystemTime(new Date("2026-03-25T00:00:01.100Z"));

    expect(await checkRateLimit("lookup:1.2.3.4", 2, 1000)).toEqual({
      allowed: true,
      retryAfterSeconds: 0,
    });
  });

  it("isolates counters by key in memory mode", async () => {
    vi.stubEnv("NODE_ENV", "test");
    const { checkRateLimit } = await importRateLimitModule();

    await checkRateLimit("submit-order:1.2.3.4", 1, 1000);
    expect(await checkRateLimit("report-payment:1.2.3.4", 1, 1000)).toEqual({
      allowed: true,
      retryAfterSeconds: 0,
    });
  });

  it("fails closed when Redis config is missing in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    const { checkRateLimit } = await importRateLimitModule();

    await expect(checkRateLimit("lookup:1.2.3.4", 5, 60_000)).resolves.toEqual(
      {
        allowed: false,
        retryAfterSeconds: 0,
        error: "backend_unavailable",
      },
    );
  });

  it("uses Redis-backed buckets in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.UPSTASH_REDIS_REST_URL = "https://upstash.example.com";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token";
    process.env.RATE_LIMIT_PREFIX = "test-prefix";
    execMock.mockResolvedValue([6, 2500]);
    const { checkRateLimit } = await importRateLimitModule();

    await expect(
      checkRateLimit("lookup:1.2.3.4", 5, 60_000),
    ).resolves.toEqual({
      allowed: false,
      retryAfterSeconds: 3,
    });
    expect(redisConstructorMock).toHaveBeenCalledWith({
      url: "https://upstash.example.com",
      token: "token",
    });
    const bucket = Math.floor(
      new Date("2026-03-25T00:00:00.000Z").getTime() / 60_000,
    );
    expect(execMock).toHaveBeenCalledWith(
      [`test-prefix:lookup:1.2.3.4:${bucket}`],
      ["60000"],
    );
  });
});
