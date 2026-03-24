import { NextRequest, NextResponse } from "next/server";
import { findByNicknameOrOrderNumber } from "@/lib/db/orders";

export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.get("q")?.trim();

    if (!q) {
      return NextResponse.json({ error: "q is required" }, { status: 400 });
    }

    const orders = await findByNicknameOrOrderNumber(q);

    // Strip PII — only return fields needed by the lookup page
    const safeOrders = orders.map((order) => ({
      id: order.id,
      order_number: order.order_number,
      status: order.status,
      total_amount: order.total_amount,
      shipping_fee: order.shipping_fee,
      created_at: order.created_at,
      order_items: order.order_items.map((item) => ({
        id: item.id,
        product_name: item.product_name,
        quantity: item.quantity,
        subtotal: item.subtotal,
      })),
      user: order.user ? { nickname: order.user.nickname } : null,
    }));

    return NextResponse.json({ orders: safeOrders });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
