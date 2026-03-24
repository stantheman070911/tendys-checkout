import { NextRequest, NextResponse } from "next/server";
import { reportPayment } from "@/lib/db/orders";

export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const { order_id, payment_amount, payment_last5 } = body as {
      order_id?: string;
      payment_amount?: number;
      payment_last5?: string;
    };

    // Validate order_id
    if (!order_id || typeof order_id !== "string" || !order_id.trim()) {
      return NextResponse.json(
        { error: "order_id is required" },
        { status: 400 },
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
