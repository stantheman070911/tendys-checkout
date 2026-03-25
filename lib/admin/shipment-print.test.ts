import { describe, expect, it } from "vitest";
import { buildShipmentPrintDocument } from "./shipment-print";

describe("buildShipmentPrintDocument", () => {
  it("renders all requested shipment slips and escapes customer fields", () => {
    const html = buildShipmentPrintDocument([
      {
        id: "o1",
        order_number: "ORD-001",
        user_id: "u1",
        round_id: "r1",
        total_amount: 560,
        shipping_fee: 60,
        status: "confirmed",
        payment_amount: null,
        payment_last5: null,
        payment_reported_at: null,
        confirmed_at: null,
        shipped_at: null,
        note: null,
        pickup_location: null,
        cancel_reason: null,
        submission_key: null,
        line_user_id: null,
        created_at: "2026-03-24T09:00:00.000Z",
        user: {
          id: "u1",
          nickname: "<王小明>",
          purchaser_name: "王大明",
          recipient_name: "王小明",
          phone: "0900-000-001",
          address: "台北市 <信義區>",
          email: null,
          created_at: "2026-03-24T09:00:00.000Z",
          updated_at: "2026-03-24T09:00:00.000Z",
        },
        order_items: [
          {
            id: "oi1",
            order_id: "o1",
            product_id: "p1",
            product_name: "地瓜",
            unit_price: 250,
            quantity: 2,
            subtotal: 500,
          },
        ],
      },
    ]);

    expect(html).toContain("ORD-001");
    expect(html).toContain("地瓜");
    expect(html).toContain("宅配運費");
    expect(html).toContain("&lt;王小明&gt;");
    expect(html).toContain("台北市 &lt;信義區&gt;");
  });
});
