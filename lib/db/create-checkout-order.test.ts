import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const { txMock, prismaMock } = vi.hoisted(() => {
  const txMock = {
    order: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    round: {
      findUnique: vi.fn(),
    },
    product: {
      findMany: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    $executeRaw: vi.fn(),
    $queryRaw: vi.fn(),
  };

  const prismaMock = {
    order: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(async (cb: (tx: typeof txMock) => unknown) => cb(txMock)),
  };

  return { txMock, prismaMock };
});

vi.mock("@/lib/db/prisma", () => ({
  prisma: prismaMock,
}));

import { createCheckoutOrder } from "./orders";

function makeRound(overrides: Record<string, unknown> = {}) {
  return {
    id: "round-1",
    is_open: true,
    deadline: null,
    shipping_fee: 100,
    pickup_option_a: "面交點 A",
    pickup_option_b: "面交點 B",
    ...overrides,
  };
}

function makeProduct(overrides: Record<string, unknown> = {}) {
  return {
    id: "prod-1",
    round_id: "round-1",
    name: "地瓜",
    price: 150,
    unit: "袋",
    is_active: true,
    stock: 50,
    ...overrides,
  };
}

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "user-1",
    nickname: "TestUser",
    recipient_name: "Test Name",
    phone: "0900-000-001",
    address: "台北市信義區測試路 1 號",
    email: null,
    ...overrides,
  };
}

function makeInput(overrides: Record<string, unknown> = {}) {
  return {
    round_id: "round-1",
    pickup_location: "",
    submission_key: "550e8400-e29b-41d4-a716-446655440000",
    items: [{ product_id: "prod-1", quantity: 2 }],
    is_admin: false,
    user: {
      nickname: "TestUser",
      recipient_name: "Test Name",
      phone: "0900-000-001",
      address: "台北市信義區測試路 1 號",
      email: undefined,
    },
    ...overrides,
  };
}

describe("createCheckoutOrder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    txMock.order.findUnique.mockResolvedValue(null);
    txMock.user.findUnique.mockResolvedValue(null);
    txMock.round.findUnique.mockResolvedValue(makeRound());
    txMock.product.findMany.mockResolvedValue([makeProduct()]);
    txMock.$executeRaw.mockResolvedValue(1);
    txMock.$queryRaw.mockResolvedValue([makeUser()]);
    txMock.order.create.mockImplementation(async ({ data }) => ({
      id: "order-1",
      order_number: "ORD-20260324-001",
      ...data,
      order_items: data.order_items?.create ?? [],
    }));
    prismaMock.order.findUnique.mockResolvedValue(null);
  });

  it("dedup short-circuits before any user mutation", async () => {
    txMock.order.findUnique.mockResolvedValueOnce({
      id: "order-existing",
      order_number: "ORD-20260324-001",
      order_items: [],
    });

    const result = await createCheckoutOrder(makeInput());

    expect(result).toEqual({
      kind: "success",
      order: expect.objectContaining({ id: "order-existing" }),
      deduplicated: true,
    });
    expect(txMock.user.findUnique).not.toHaveBeenCalled();
    expect(txMock.$queryRaw).not.toHaveBeenCalled();
    expect(txMock.order.create).not.toHaveBeenCalled();
  });

  it("reuses a public nickname when saved details match", async () => {
    txMock.user.findUnique.mockResolvedValueOnce(makeUser());

    const result = await createCheckoutOrder(makeInput());

    expect(result).toEqual({
      kind: "success",
      order: expect.objectContaining({ id: "order-1" }),
      deduplicated: false,
    });
    expect(txMock.$queryRaw).not.toHaveBeenCalled();
    expect(txMock.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ user_id: "user-1" }),
      }),
    );
  });

  it("returns nickname_conflict for a public nickname with mismatched details", async () => {
    txMock.user.findUnique.mockResolvedValueOnce(
      makeUser({ recipient_name: "Other Name" }),
    );

    const result = await createCheckoutOrder(makeInput());

    expect(result).toEqual({ kind: "nickname_conflict" });
    expect(txMock.order.create).not.toHaveBeenCalled();
  });

  it("updates an existing nickname for admin checkout", async () => {
    txMock.user.findUnique.mockResolvedValueOnce(makeUser());
    txMock.$queryRaw.mockResolvedValueOnce([
      makeUser({ recipient_name: "Updated Name" }),
    ]);

    const result = await createCheckoutOrder(
      makeInput({
        is_admin: true,
        user: {
          nickname: "TestUser",
          recipient_name: "Updated Name",
          phone: "0900-000-001",
          address: "台北市信義區測試路 1 號",
          email: "admin@example.com",
        },
      }),
    );

    expect(result).toEqual({
      kind: "success",
      order: expect.objectContaining({ id: "order-1" }),
      deduplicated: false,
    });
    expect(txMock.$queryRaw).toHaveBeenCalledTimes(1);
    expect(txMock.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ user_id: "user-1" }),
      }),
    );
  });

  it("re-fetches and reuses a concurrently created public nickname", async () => {
    txMock.user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(makeUser());
    txMock.$queryRaw.mockResolvedValueOnce([]);

    const result = await createCheckoutOrder(makeInput());

    expect(result).toEqual({
      kind: "success",
      order: expect.objectContaining({ id: "order-1" }),
      deduplicated: false,
    });
    expect(txMock.user.findUnique).toHaveBeenCalledTimes(2);
  });

  it("returns schema_drift_access_code on Prisma P2011 access_code errors", async () => {
    txMock.user.findUnique.mockResolvedValueOnce(makeUser());
    txMock.order.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Null constraint failed", {
        code: "P2011",
        clientVersion: "0.0.0",
        meta: { constraint: ["access_code"] },
      }),
    );

    const result = await createCheckoutOrder(makeInput());

    expect(result).toEqual({
      kind: "schema_drift_access_code",
      error: expect.stringContaining("migration_007_remove_access_code.sql"),
    });
  });

  it("returns validation_error when pickup_location is not allowed by the round", async () => {
    txMock.user.findUnique.mockResolvedValueOnce(makeUser());

    const result = await createCheckoutOrder(
      makeInput({ pickup_location: "台中面交點" }),
    );

    expect(result).toEqual({
      kind: "validation_error",
      error: "Invalid pickup_location for this round",
    });
    expect(txMock.order.create).not.toHaveBeenCalled();
  });
});
