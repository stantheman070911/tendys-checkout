import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Transaction mock ────────────────────────────────────────

const txMock = vi.hoisted(() => ({
  order: {
    findUnique: vi.fn().mockResolvedValue(null), // no dedup hit
    create: vi.fn(),
  },
  round: { findUnique: vi.fn() },
  product: { findMany: vi.fn() },
  $executeRaw: vi.fn().mockResolvedValue(1), // stock decrement succeeds
}));

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(async (cb: (tx: typeof txMock) => unknown) => cb(txMock)),
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: prismaMock }));

import { createWithItems } from "./orders";

// ── Helpers ─────────────────────────────────────────────────

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

const BASE_DATA = {
  round_id: "round-1",
  user_id: "user-1",
  pickup_location: "",
};

const BASE_ITEMS = [{ product_id: "prod-1", quantity: 2 }];

// ── Tests ───────────────────────────────────────────────────

describe("createWithItems — shipping fee snapshot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    txMock.order.findUnique.mockResolvedValue(null);
    txMock.$executeRaw.mockResolvedValue(1);
    txMock.order.create.mockImplementation(async ({ data }) => ({
      id: "order-1",
      ...data,
      order_items: data.order_items?.create ?? [],
    }));
  });

  it("delivery order snapshots round.shipping_fee into order", async () => {
    txMock.round.findUnique.mockResolvedValue(makeRound({ shipping_fee: 100 }));
    txMock.product.findMany.mockResolvedValue([makeProduct()]);

    const result = await createWithItems(BASE_DATA, BASE_ITEMS, "key-1");

    expect(result).toHaveProperty("order");
    expect(result).not.toHaveProperty("error");

    // Verify the payload passed to tx.order.create
    const createCall = txMock.order.create.mock.calls[0]![0];
    expect(createCall.data.shipping_fee).toBe(100);
    expect(createCall.data.total_amount).toBe(150 * 2 + 100); // items + fee
  });

  it("delivery order with null round fee stores no surcharge", async () => {
    txMock.round.findUnique.mockResolvedValue(
      makeRound({ shipping_fee: null }),
    );
    txMock.product.findMany.mockResolvedValue([makeProduct()]);

    const result = await createWithItems(BASE_DATA, BASE_ITEMS, "key-2");

    expect(result).toHaveProperty("order");

    const createCall = txMock.order.create.mock.calls[0]![0];
    expect(createCall.data.shipping_fee).toBeNull();
    expect(createCall.data.total_amount).toBe(150 * 2); // items only
  });

  it("pickup order ignores round shipping_fee", async () => {
    txMock.round.findUnique.mockResolvedValue(
      makeRound({
        shipping_fee: 100,
        pickup_option_a: "台北面交點",
      }),
    );
    txMock.product.findMany.mockResolvedValue([makeProduct()]);

    const pickupData = { ...BASE_DATA, pickup_location: "台北面交點" };
    const result = await createWithItems(pickupData, BASE_ITEMS, "key-3");

    expect(result).toHaveProperty("order");

    const createCall = txMock.order.create.mock.calls[0]![0];
    expect(createCall.data.shipping_fee).toBeNull();
    expect(createCall.data.total_amount).toBe(150 * 2); // no fee added
    expect(createCall.data.pickup_location).toBe("台北面交點");
  });
});
