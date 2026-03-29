import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sessionStore = new Map<string, { email: string }>();
const storeMock = vi.hoisted(() => ({
  get: vi.fn(async (key: string) => sessionStore.get(key) ?? null),
  set: vi.fn(
    async (
      key: string,
      value: { email: string },
    ) => {
      sessionStore.set(key, value);
    },
  ),
  del: vi.fn(async (key: string) => {
    const existed = sessionStore.delete(key);
    return existed ? 1 : 0;
  }),
  ping: vi.fn(async () => "PONG"),
}));

vi.mock("@/lib/upstash", () => ({
  getKeyValueStore: () => storeMock,
}));

const ORIGINAL_ENV = { ...process.env };

describe("admin session storage", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    sessionStore.clear();
    process.env = {
      ...ORIGINAL_ENV,
      ADMIN_EMAILS: "admin@example.com",
      ADMIN_SESSION_SECRET: "admin-session-secret",
      NODE_ENV: "test",
    };
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("creates a revocable admin session and validates it against the store", async () => {
    const mod = await import("./supabase-admin");
    const session = await mod.createAdminSession("admin@example.com");

    const claims = await mod.readAdminSessionValue(session.value);

    expect(claims).toMatchObject({
      email: "admin@example.com",
      sid: session.claims.sid,
    });
    expect(storeMock.set).toHaveBeenCalledWith(
      `admin-session:${session.claims.sid}`,
      { email: "admin@example.com" },
      { ex: mod.ADMIN_SESSION_MAX_AGE_SECONDS },
    );
  });

  it("revokes an admin session by deleting its Redis record", async () => {
    const mod = await import("./supabase-admin");
    const session = await mod.createAdminSession("admin@example.com");

    await mod.revokeAdminSession(session.claims.sid);
    const claims = await mod.readAdminSessionValue(session.value);

    expect(claims).toBeNull();
    expect(storeMock.del).toHaveBeenCalledWith(
      `admin-session:${session.claims.sid}`,
    );
  });
});
