import { NextRequest, NextResponse } from "next/server";
import { findPublicOrderByOrderNumberAndIdentity } from "@/lib/db/orders";
import { listActiveByRound } from "@/lib/db/products";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { maskPhone, normalizePhoneDigits } from "@/lib/utils";

export async function POST(request: NextRequest) {
  try {
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(`lookup-order:${clientIp}`, 5, 60_000);
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

    const { order_number, recipient_name, phone_last3 } = body as {
      order_number?: string;
      recipient_name?: string;
      phone_last3?: string;
    };

    const orderNumber = order_number?.trim().toUpperCase();
    const recipientName = recipient_name?.trim();
    const phoneLast3 = normalizePhoneDigits(phone_last3?.trim());

    if (!orderNumber) {
      return NextResponse.json(
        { error: "order_number is required" },
        { status: 400 },
      );
    }
    if (!recipientName) {
      return NextResponse.json(
        { error: "recipient_name is required" },
        { status: 400 },
      );
    }
    if (phoneLast3.length !== 3) {
      return NextResponse.json(
        { error: "phone_last3 must be exactly 3 digits" },
        { status: 400 },
      );
    }

    const order = await findPublicOrderByOrderNumberAndIdentity(
      orderNumber,
      recipientName,
      phoneLast3,
    );
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    let anyUnderGoal = false;
    if (order.round_id) {
      const products = await listActiveByRound(order.round_id);
      anyUnderGoal = products.some(
        (product) =>
          product.goal_qty !== null &&
          Number(product.current_qty) < Number(product.goal_qty),
      );
    }

    return NextResponse.json({
      any_under_goal: anyUnderGoal,
      order: {
        id: order.id,
        order_number: order.order_number,
        round_id: order.round_id,
        total_amount: order.total_amount,
        shipping_fee: order.shipping_fee,
        status: order.status,
        payment_amount: order.payment_amount,
        payment_last5: order.payment_last5,
        payment_reported_at: order.payment_reported_at,
        confirmed_at: order.confirmed_at,
        shipped_at: order.shipped_at,
        note: order.note,
        pickup_location: order.pickup_location,
        cancel_reason: order.cancel_reason,
        line_user_id: order.line_user_id,
        created_at: order.created_at,
        user: order.user
          ? {
              recipient_name: order.user.recipient_name,
              phone: order.user.phone,
              address: order.user.address,
              masked_phone: maskPhone(order.user.phone),
            }
          : null,
        order_items: order.order_items.map((item) => ({
          id: item.id,
          product_id: item.product_id,
          product_name: item.product_name,
          unit_price: item.unit_price,
          quantity: item.quantity,
          subtotal: item.subtotal,
        })),
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
