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
      create: vi.fn(),
    },
    savedCheckoutProfile: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    $executeRaw: vi.fn(),
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
    purchaser_name: "Buyer Name",
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
    save_profile: false,
    user: {
      nickname: "TestUser",
      purchaser_name: "Buyer Name",
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
    vi.resetAllMocks();
    prismaMock.$transaction.mockImplementation(
      async (cb: (tx: typeof txMock) => unknown) => cb(txMock),
    );
    txMock.order.findUnique.mockResolvedValue(null);
    txMock.round.findUnique.mockResolvedValue(makeRound());
    txMock.product.findMany.mockResolvedValue([makeProduct()]);
    txMock.$executeRaw.mockResolvedValue(1);
    txMock.user.create.mockResolvedValue(makeUser());
    txMock.savedCheckoutProfile.findUnique.mockResolvedValue(null);
    txMock.savedCheckoutProfile.create.mockResolvedValue({
      id: "profile-1",
      nickname: "TestUser",
    });
    txMock.savedCheckoutProfile.update.mockResolvedValue({
      id: "profile-1",
      nickname: "TestUser",
    });
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
    expect(txMock.user.create).not.toHaveBeenCalled();
    expect(txMock.savedCheckoutProfile.findUnique).not.toHaveBeenCalled();
    expect(txMock.order.create).not.toHaveBeenCalled();
  });

  it("creates a fresh user snapshot for public checkout without saving a profile", async () => {
    const result = await createCheckoutOrder(makeInput());

    expect(result).toEqual({
      kind: "success",
      order: expect.objectContaining({ id: "order-1" }),
      deduplicated: false,
    });
    expect(txMock.savedCheckoutProfile.findUnique).not.toHaveBeenCalled();
    expect(txMock.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ user_id: "user-1" }),
      }),
    );
  });

  it("still creates the order when save_profile is false even if a saved profile exists", async () => {
    txMock.savedCheckoutProfile.findUnique.mockResolvedValueOnce({
      id: "profile-1",
      nickname: "TestUser",
      phone: "0900-000-999",
    });

    const result = await createCheckoutOrder(
      makeInput({ save_profile: false }),
    );

    expect(result).toEqual({
      kind: "success",
      order: expect.objectContaining({ id: "order-1" }),
      deduplicated: false,
    });
    expect(txMock.savedCheckoutProfile.findUnique).not.toHaveBeenCalled();
  });

  it("creates a saved profile when save_profile is true and none exists", async () => {
    const result = await createCheckoutOrder(makeInput({ save_profile: true }));

    expect(result).toEqual({
      kind: "success",
      order: expect.objectContaining({ id: "order-1" }),
      deduplicated: false,
    });
    expect(txMock.savedCheckoutProfile.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          nickname: "TestUser",
          purchaser_name: "Buyer Name",
          recipient_name: "Test Name",
        }),
      }),
    );
  });

  it("updates a saved profile when nickname exists and phone matches", async () => {
    txMock.savedCheckoutProfile.findUnique.mockResolvedValueOnce({
      id: "profile-1",
      nickname: "TestUser",
      purchaser_name: "Old Buyer",
      recipient_name: "Old Recipient",
      phone: "0900-000-001",
      address: "舊地址",
      email: null,
    });

    const result = await createCheckoutOrder(makeInput({ save_profile: true }));

    expect(result).toEqual({
      kind: "success",
      order: expect.objectContaining({ id: "order-1" }),
      deduplicated: false,
    });
    expect(txMock.savedCheckoutProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { nickname: "TestUser" },
      }),
    );
  });

  it("returns saved_profile_phone_mismatch when nickname exists but phone differs", async () => {
    txMock.savedCheckoutProfile.findUnique.mockResolvedValueOnce({
      id: "profile-1",
      nickname: "TestUser",
      purchaser_name: "Old Buyer",
      recipient_name: "Old Recipient",
      phone: "0900-000-999",
      address: "舊地址",
      email: null,
    });

    const result = await createCheckoutOrder(makeInput({ save_profile: true }));

    expect(result).toEqual({ kind: "saved_profile_phone_mismatch" });
    expect(txMock.order.create).not.toHaveBeenCalled();
  });

  it("creates an admin order snapshot without touching saved profiles", async () => {

    const result = await createCheckoutOrder(
      makeInput({
        is_admin: true,
        user: {
          nickname: "TestUser",
          purchaser_name: "Updated Buyer",
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
    expect(txMock.savedCheckoutProfile.findUnique).not.toHaveBeenCalled();
    expect(txMock.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ user_id: "user-1" }),
      }),
    );
  });

  it("returns schema_drift_access_code on Prisma P2011 access_code errors", async () => {
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
