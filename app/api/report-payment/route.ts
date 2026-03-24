import { NextRequest, NextResponse } from "next/server";
import { reportPayment, getOrderWithItems } from "@/lib/db/orders";

export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const { order_id, payment_amount, payment_last5, phone_last4 } = body as {
      order_id?: string;
      payment_amount?: number;
      payment_last5?: string;
      phone_last4?: string;
    };

    // Validate order_id
    if (!order_id || typeof order_id !== "string" || !order_id.trim()) {
      return NextResponse.json(
        { error: "order_id is required" },
        { status: 400 },
      );
    }

    // Validate phone_last4 (ownership verification)
    if (
      !phone_last4 ||
      typeof phone_last4 !== "string" ||
      !/^\d{4}$/.test(phone_last4)
    ) {
      return NextResponse.json(
        { error: "phone_last4 must be exactly 4 digits" },
        { status: 400 },
      );
    }

    // Verify phone_last4 matches the order's user
    const existingOrder = await getOrderWithItems(order_id.trim());
    if (!existingOrder) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 },
      );
    }
    const userPhone = existingOrder.user?.phone?.replace(/\D/g, "") ?? "";
    if (userPhone.slice(-4) !== phone_last4) {
      return NextResponse.json(
        { error: "Phone verification failed" },
        { status: 403 },
      );
    }

    // Validate payment_amount
    if (
      payment_amount === undefined ||
      typeof payment_amount !== "number" ||
      !Number.isInteger(payment_amount) ||
      payment_amount <= 0
    ) {
      return NextResponse.json(
        { error: "payment_amount must be a positive integer" },
        { status: 400 },
      );
    }

    // Validate payment_last5
    if (
      !payment_last5 ||
      typeof payment_last5 !== "string" ||
      payment_last5.trim().length !== 5 ||
      !/^\d{5}$/.test(payment_last5.trim())
    ) {
      return NextResponse.json(
        { error: "payment_last5 must be exactly 5 digits" },
        { status: 400 },
      );
    }

    const order = await reportPayment(
      order_id.trim(),
      payment_amount,
      payment_last5.trim(),
    );

    if (!order) {
      return NextResponse.json(
        { error: "Order not found or not in pending_payment status" },
        { status: 404 },
      );
    }

    return NextResponse.json({ order });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
