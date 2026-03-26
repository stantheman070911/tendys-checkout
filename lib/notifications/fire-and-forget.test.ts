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

  it("registers deferred background work with next/server after", async () => {
    const task = vi.fn(async () => undefined);
    let scheduledTask: (() => Promise<void>) | undefined;
    afterMock.mockImplementation((callback: () => Promise<void>) => {
      scheduledTask = callback;
    });

    fireAndForget(task);

    expect(afterMock).toHaveBeenCalledTimes(1);
    expect(task).not.toHaveBeenCalled();

    await scheduledTask?.();

    expect(task).toHaveBeenCalledTimes(1);
  });

  it("falls back to waitUntil when after is unavailable", async () => {
    const waitUntil = vi.fn();
    const task = vi.fn(async () => undefined);
    afterMock.mockImplementation(() => {
      throw new Error("outside request");
    });
    (
      globalThis as typeof globalThis & {
        waitUntil?: (promise: Promise<void>) => void;
      }
    ).waitUntil = waitUntil;

    fireAndForget(task);

    expect(waitUntil).toHaveBeenCalledTimes(1);
    expect(task).toHaveBeenCalledTimes(1);
  });
});
