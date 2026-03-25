import { beforeEach, describe, expect, it, vi } from "vitest";

const afterMock = vi.hoisted(() => vi.fn());

vi.mock("next/server", () => ({
  after: afterMock,
}));

import { fireAndForget } from "./fire-and-forget";

describe("fireAndForget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete (globalThis as typeof globalThis & { waitUntil?: unknown }).waitUntil;
  });

  it("registers background work with next/server after when request context exists", async () => {
    afterMock.mockImplementation(() => undefined);

    fireAndForget(async () => undefined);

    expect(afterMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to waitUntil when after is unavailable", async () => {
    const waitUntil = vi.fn();
    afterMock.mockImplementation(() => {
      throw new Error("outside request");
    });
    (
      globalThis as typeof globalThis & {
        waitUntil?: (promise: Promise<void>) => void;
      }
    ).waitUntil = waitUntil;

    fireAndForget(async () => undefined);

    expect(waitUntil).toHaveBeenCalledTimes(1);
  });
});
