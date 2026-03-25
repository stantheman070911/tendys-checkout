import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  EnvironmentConfigurationError,
  getAdminSessionSecret,
  getPublicOrderAccessSecret,
  getRateLimitConfig,
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
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
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
});
