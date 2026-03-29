import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  EnvironmentConfigurationError,
  getAdminSessionSecret,
  getNotificationWorkerAuthorizationSecret,
  getProductionRuntimeValidationErrors,
  getPublicOrderAccessSecret,
  getRateLimitConfig,
  resetProductionRuntimeValidationForTests,
  validateProductionRuntimeConfig,
} from "@/lib/server-env";

const ORIGINAL_ENV = { ...process.env };

describe("server env helpers", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...ORIGINAL_ENV };
    delete process.env.ADMIN_SESSION_SECRET;
    delete process.env.PUBLIC_ORDER_ACCESS_SECRET;
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    delete process.env.RATE_LIMIT_PREFIX;
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_FROM_EMAIL;
    delete process.env.LINE_CHANNEL_ACCESS_TOKEN;
    delete process.env.LINE_CHANNEL_SECRET;
    delete process.env.NOTIFICATION_WORKER_SECRET;
    delete process.env.CRON_SECRET;
    delete process.env.SENTRY_DSN;
    delete process.env.OPS_ALERT_WEBHOOK_URL;
    delete process.env.ALLOW_BEARER_ADMIN_SESSION_FALLBACK;
    resetProductionRuntimeValidationForTests();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    resetProductionRuntimeValidationForTests();
  });

  it("requires dedicated signing secrets in production", () => {
    vi.stubEnv("NODE_ENV", "production");

    expect(() => getAdminSessionSecret()).toThrow(EnvironmentConfigurationError);
    expect(() => getPublicOrderAccessSecret()).toThrow(
      EnvironmentConfigurationError,
    );
  });

  it("uses explicit development fallbacks outside production", () => {
    vi.stubEnv("NODE_ENV", "test");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(getAdminSessionSecret()).toBe("dev-only-admin-session-secret");
    expect(getPublicOrderAccessSecret()).toBe("dev-only-public-order-secret");
    expect(getAdminSessionSecret()).not.toBe(getPublicOrderAccessSecret());
    expect(warnSpy).toHaveBeenCalledTimes(2);
  });

  it("reads configured rate limit env vars in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.UPSTASH_REDIS_REST_URL = "https://upstash.example.com";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token";
    process.env.RATE_LIMIT_PREFIX = "custom-prefix";

    expect(getRateLimitConfig()).toEqual({
      prefix: "custom-prefix",
      url: "https://upstash.example.com",
      token: "token",
    });
  });

  it("requires Upstash config in production", () => {
    vi.stubEnv("NODE_ENV", "production");

    expect(() => getRateLimitConfig()).toThrow(EnvironmentConfigurationError);
  });

  it("reports all production runtime validation failures", () => {
    vi.stubEnv("NODE_ENV", "production");

    expect(getProductionRuntimeValidationErrors()).toEqual(
      expect.arrayContaining([
        "Missing required environment variable: NOTIFICATION_WORKER_SECRET",
        "Missing required environment variable: CRON_SECRET",
        "Missing required environment variable: SENTRY_DSN",
        "Missing required environment variable: OPS_ALERT_WEBHOOK_URL",
      ]),
    );
  });

  it("prefers CRON_SECRET for notification worker authorization when configured", () => {
    vi.stubEnv("NODE_ENV", "test");
    process.env.NOTIFICATION_WORKER_SECRET = "worker-secret";
    process.env.CRON_SECRET = "cron-secret";

    expect(getNotificationWorkerAuthorizationSecret()).toBe("cron-secret");
  });

  it("treats bearer fallback as a production misconfiguration", () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.ADMIN_SESSION_SECRET = "admin-secret";
    process.env.PUBLIC_ORDER_ACCESS_SECRET = "public-secret";
    process.env.UPSTASH_REDIS_REST_URL = "https://upstash.example.com";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token";
    process.env.RESEND_API_KEY = "re_test";
    process.env.RESEND_FROM_EMAIL = "orders@example.com";
    process.env.LINE_CHANNEL_ACCESS_TOKEN = "line-token";
    process.env.LINE_CHANNEL_SECRET = "line-secret";
    process.env.NOTIFICATION_WORKER_SECRET = "worker-secret";
    process.env.SENTRY_DSN = "https://dsn@example.com/1";
    process.env.OPS_ALERT_WEBHOOK_URL = "https://hooks.slack.test";
    process.env.ALLOW_BEARER_ADMIN_SESSION_FALLBACK = "true";

    expect(() => validateProductionRuntimeConfig()).toThrow(
      EnvironmentConfigurationError,
    );
  });
});
