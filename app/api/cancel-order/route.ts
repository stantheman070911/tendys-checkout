import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/auth/supabase-admin";
import {
  cancelOrder,
  findOrderByNumberAndAccessCode,
} from "@/lib/db/orders";
import { sendOrderCancelledNotifications } from "@/lib/notifications/send";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { normalizeAccessCode } from "@/lib/utils";

export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const { orderId, order_number, access_code, cancel_reason } = body as {
      orderId?: string;
      order_number?: string;
      access_code?: string;
      cancel_reason?: string;
    };

    // Determine mode by auth — don't 401 if not admin, just use user mode
    const isAdmin = await verifyAdminSession(request);

    let resolvedOrderId = orderId?.trim();

    // Non-admin callers must provide order_number + access_code
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

      if (
        !order_number ||
        typeof order_number !== "string" ||
        !order_number.trim()
      ) {
        return NextResponse.json(
          { error: "order_number is required" },
          { status: 400 },
        );
      }
      if (
        !access_code ||
        typeof access_code !== "string" ||
        normalizeAccessCode(access_code).length !== 12
      ) {
        return NextResponse.json(
          { error: "access_code must be exactly 12 letters or digits" },
          { status: 400 },
        );
      }

      const order = await findOrderByNumberAndAccessCode(
        order_number.trim().toUpperCase(),
        normalizeAccessCode(access_code),
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
