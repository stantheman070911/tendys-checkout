import { describe, expect, it } from "vitest";
import {
  buildOrderItemsPreview,
  detailToAdminOrderListRow,
  toAdminOrderListRow,
} from "./order-view";

describe("order view mappers", () => {
  it("builds a compact items preview", () => {
    expect(
      buildOrderItemsPreview([
        { product_name: "地瓜", quantity: 2 },
        { product_name: "雞蛋", quantity: 1 },
      ]),
    ).toBe("地瓜 ×2、雞蛋 ×1");
  });

  it("serializes thin admin rows from preview data", () => {
    const row = toAdminOrderListRow({
      id: "o1",
      order_number: "ORD-001",
      round_id: "r1",
      total_amount: 560,
      shipping_fee: 60,
      status: "pending_confirm",
      payment_amount: 560,
      payment_last5: "12345",
      payment_reported_at: new Date("2026-03-24T10:00:00.000Z"),
      confirmed_at: null,
      shipped_at: null,
      pickup_location: null,
      created_at: new Date("2026-03-24T09:00:00.000Z"),
      user: {
        nickname: "王小明",
        purchaser_name: "王大明",
        recipient_name: "王小明",
        phone: "0900-000-001",
      },
      order_items: [{ product_name: "地瓜", quantity: 2 }],
    });

    expect(row).toMatchObject({
      id: "o1",
      order_number: "ORD-001",
      status: "pending_confirm",
      items_preview: "地瓜 ×2",
      created_at: "2026-03-24T09:00:00.000Z",
      payment_reported_at: "2026-03-24T10:00:00.000Z",
    });
  });

  it("reuses a provided preview string for full details", () => {
    const row = detailToAdminOrderListRow({
      id: "o2",
      order_number: "ORD-002",
      user_id: "u1",
      round_id: "r1",
      total_amount: 300,
      shipping_fee: null,
      status: "confirmed",
      payment_amount: 300,
      payment_last5: "54321",
      payment_reported_at: "2026-03-24T11:00:00.000Z",
      confirmed_at: "2026-03-24T11:30:00.000Z",
      shipped_at: null,
      note: null,
      pickup_location: "市政府站",
      cancel_reason: null,
      submission_key: null,
      line_user_id: null,
      created_at: "2026-03-24T10:30:00.000Z",
      user: null,
      order_items: [
        {
          id: "oi1",
          order_id: "o2",
          product_id: "p1",
          product_name: "雞蛋",
          unit_price: 300,
          quantity: 1,
          subtotal: 300,
        },
      ],
    });

    expect(row.items_preview).toBe("雞蛋 ×1");
    expect(row.pickup_location).toBe("市政府站");
  });
});
