import { NextRequest, NextResponse } from "next/server";
import { findOrdersByPurchaserNameAndPhoneLast3 } from "@/lib/db/orders";
import {
  buildPublicOrderAccessPath,
  createPublicOrderAccessToken,
} from "@/lib/public-order-access";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { normalizePhoneDigits } from "@/lib/utils";

export async function POST(request: NextRequest) {
  try {
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(`lookup:${clientIp}`, 5, 60_000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        {
          status: 429,
          headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
        },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const { purchaser_name, recipient_name, phone_last3 } = body as {
      purchaser_name?: string;
      recipient_name?: string;
      phone_last3?: string;
    };

    const purchaserName = purchaser_name?.trim() || recipient_name?.trim();
    const phoneLast3 = normalizePhoneDigits(phone_last3?.trim());

    if (!purchaserName) {
      return NextResponse.json(
        { error: "purchaser_name is required" },
        { status: 400 },
      );
    }
    if (phoneLast3.length !== 3) {
      return NextResponse.json(
        { error: "phone_last3 must be exactly 3 digits" },
        { status: 400 },
      );
    }

    const orders = await findOrdersByPurchaserNameAndPhoneLast3(
      purchaserName,
      phoneLast3,
    );

    if (orders.length === 0) {
      return NextResponse.json({ error: "Orders not found" }, { status: 404 });
    }

    const safeOrders = orders.map((order) => ({
      order_number: order.order_number,
      status: order.status,
      total_amount: order.total_amount,
      shipping_fee: order.shipping_fee,
      created_at: order.created_at,
      access_token: createPublicOrderAccessToken({
        orderNumber: order.order_number,
        purchaserName,
        phoneLast3,
      }),
      order_items: order.order_items.map((item) => ({
        id: item.id,
        product_name: item.product_name,
        quantity: item.quantity,
        subtotal: item.subtotal,
      })),
    })).map((order) => ({
      ...order,
      detail_url: buildPublicOrderAccessPath(order.access_token),
    }));

    return NextResponse.json({ orders: safeOrders });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
