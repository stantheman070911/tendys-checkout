import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/auth/supabase-admin";
import {
  cancelOrder,
  findPublicOrderByOrderNumberAndIdentity,
} from "@/lib/db/orders";
import { sendOrderCancelledNotifications } from "@/lib/notifications/send";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { normalizePhoneDigits } from "@/lib/utils";

export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const { orderId, order_number, purchaser_name, recipient_name, phone_last3, cancel_reason } = body as {
      orderId?: string;
      order_number?: string;
      purchaser_name?: string;
      recipient_name?: string;
      phone_last3?: string;
      cancel_reason?: string;
    };

    // Determine mode by auth — don't 401 if not admin, just use user mode
    const isAdmin = await verifyAdminSession(request);

    let resolvedOrderId = orderId?.trim();

    // Non-admin callers must provide order_number + public identity
    if (!isAdmin) {
      const clientIp = getClientIp(request);
      const rateLimit = checkRateLimit(`cancel-order:${clientIp}`, 5, 60_000);
      if (!rateLimit.allowed) {
        return NextResponse.json(
          { error: "Too many requests" },
          {
            status: 429,
            headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
          },
        );
      }

      const orderNumber =
        typeof order_number === "string"
          ? order_number.trim().toUpperCase()
          : "";
      if (!orderNumber) {
        return NextResponse.json(
          { error: "order_number is required" },
          { status: 400 },
        );
      }

      const purchaserName =
        typeof purchaser_name === "string" && purchaser_name.trim()
          ? purchaser_name.trim()
          : typeof recipient_name === "string"
            ? recipient_name.trim()
            : "";
      if (!purchaserName) {
        return NextResponse.json(
          { error: "purchaser_name is required" },
          { status: 400 },
        );
      }

      const phoneLast3 = normalizePhoneDigits(phone_last3);
      if (phoneLast3.length !== 3) {
        return NextResponse.json(
          { error: "phone_last3 must be exactly 3 digits" },
          { status: 400 },
        );
      }

      const order = await findPublicOrderByOrderNumberAndIdentity(
        orderNumber,
        purchaserName,
        phoneLast3,
      );
      if (!order) {
        return NextResponse.json(
          { error: "Order not found" },
          { status: 404 },
        );
      }
      resolvedOrderId = order.id;
    } else if (!resolvedOrderId) {
      return NextResponse.json(
        { error: "orderId is required" },
        { status: 400 },
      );
    }

    const reason =
      isAdmin && typeof cancel_reason === "string"
        ? cancel_reason.trim() || undefined
        : undefined;

    const result = await cancelOrder(resolvedOrderId, isAdmin, reason);

    if (result === null) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // Admin cancel: send cancellation notifications only if status actually changed
    let notifications = null;
    if (isAdmin && result.changed && result.order.order_items) {
      notifications = await sendOrderCancelledNotifications(
        result.order,
        result.order.order_items,
        reason,
      );
    }

    return NextResponse.json({ order: result.order, notifications });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
