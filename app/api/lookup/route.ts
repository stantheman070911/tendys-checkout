import { NextRequest, NextResponse } from "next/server";
import { findOrderByNumberAndAccessCode } from "@/lib/db/orders";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { normalizeAccessCode } from "@/lib/utils";

export async function GET(request: NextRequest) {
  try {
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(`lookup:${clientIp}`, 10, 60_000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        {
          status: 429,
          headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
        },
      );
    }

    const orderNumber = request.nextUrl.searchParams.get("orderNumber")?.trim();
    const accessCode = request.nextUrl.searchParams.get("accessCode")?.trim();

    if (!orderNumber) {
      return NextResponse.json(
        { error: "orderNumber is required" },
        { status: 400 },
      );
    }
    if (!accessCode || normalizeAccessCode(accessCode).length !== 12) {
      return NextResponse.json(
        { error: "accessCode must be exactly 12 letters or digits" },
        { status: 400 },
      );
    }

    const order = await findOrderByNumberAndAccessCode(
      orderNumber.toUpperCase(),
      normalizeAccessCode(accessCode),
    );

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const safeOrder = {
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
    };

    return NextResponse.json({ order: safeOrder });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
