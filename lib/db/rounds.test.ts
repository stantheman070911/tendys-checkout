import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const txMock = vi.hoisted(() => ({
  round: {
    updateMany: vi.fn(),
    create: vi.fn(),
  },
}));

const prismaMock = vi.hoisted(() => ({
  round: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: prismaMock,
}));

import { create, update } from "./rounds";

describe("single-open-round enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: $transaction runs the callback with txMock
    prismaMock.$transaction.mockImplementation(
      async (fn: (tx: typeof txMock) => Promise<unknown>) => fn(txMock)
    );
  });

  it("create() closes existing open rounds and creates in a single transaction", async () => {
    txMock.round.updateMany.mockResolvedValue({ count: 1 });
    txMock.round.create.mockResolvedValue({
      id: "new-round",
      name: "New Round",
      is_open: true,
    });

    await create({ name: "New Round" });

    // Both operations happen on the transaction client, not the root client
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(txMock.round.updateMany).toHaveBeenCalledWith({
      where: { is_open: true },
      data: { is_open: false },
    });
    expect(txMock.round.create).toHaveBeenCalledAfter(txMock.round.updateMany);
  });

  it("create() rolls back close if insert fails", async () => {
    prismaMock.$transaction.mockRejectedValue(new Error("insert failed"));

    await expect(create({ name: "Bad Round" })).rejects.toThrow("insert failed");
  });

  it("create() catches P2002 from concurrent creates and returns { error }", async () => {
    const p2002 = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002",
      clientVersion: "0.0.0",
    });
    prismaMock.$transaction.mockRejectedValue(p2002);

    const result = await create({ name: "Concurrent Round" });

    expect(result).toEqual({
      error: expect.stringContaining("並行衝突"),
    });
  });

  it("update() rejects opening a round when another is already open", async () => {
    prismaMock.round.findFirst.mockResolvedValue({
      id: "other-round",
      name: "Existing Open Round",
      is_open: true,
    });

    const result = await update("target-round", { is_open: true });

    expect(result).toEqual({
      error: expect.stringContaining("正在開團中"),
    });
    expect(prismaMock.round.update).not.toHaveBeenCalled();
  });

  it("update() allows opening a round when no other round is open", async () => {
    prismaMock.round.findFirst.mockResolvedValue(null);
    prismaMock.round.update.mockResolvedValue({
      id: "target-round",
      is_open: true,
    });

    const result = await update("target-round", { is_open: true });

    expect(result).toEqual({ id: "target-round", is_open: true });
    expect(prismaMock.round.update).toHaveBeenCalled();
  });

  it("update() skips open-round check when not setting is_open", async () => {
    prismaMock.round.update.mockResolvedValue({
      id: "target-round",
      name: "Updated",
    });

    await update("target-round", { name: "Updated" });

    expect(prismaMock.round.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.round.update).toHaveBeenCalled();
  });

  it("update() catches DB unique-index conflict from concurrent requests", async () => {
    prismaMock.round.findFirst.mockResolvedValue(null);
    // Simulate a P2002 unique constraint violation (concurrent open)
    const p2002 = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002",
      clientVersion: "0.0.0",
    });
    prismaMock.round.update.mockRejectedValue(p2002);

    const result = await update("target-round", { is_open: true });

    expect(result).toEqual({
      error: expect.stringContaining("並行衝突"),
    });
  });
});
