import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}));
vi.mock("@/lib/db/prisma", () => prismaMock);

const upstashMock = vi.hoisted(() => ({
  checkRedisHealth: vi.fn(),
}));
vi.mock("@/lib/upstash", () => upstashMock);

const envMock = vi.hoisted(() => ({
  getProductionRuntimeValidationErrors: vi.fn(),
  readOptionalEnv: vi.fn(),
}));
vi.mock("@/lib/server-env", () => envMock);

import { GET } from "./route";

describe("GET /health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.prisma.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);
    upstashMock.checkRedisHealth.mockResolvedValue({ ok: true, error: null });
    envMock.getProductionRuntimeValidationErrors.mockReturnValue([]);
    envMock.readOptionalEnv.mockReturnValue("worker-secret");
  });

  it("returns 200 when all checks pass", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({ status: "ok" }),
    );
  });

  it("returns 503 when runtime config is degraded", async () => {
    envMock.getProductionRuntimeValidationErrors.mockReturnValue([
      "Missing required environment variable: CRON_SECRET",
    ]);

    const response = await GET();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        status: "degraded",
        checks: expect.objectContaining({
          env: "fail",
        }),
      }),
    );
  });
});
