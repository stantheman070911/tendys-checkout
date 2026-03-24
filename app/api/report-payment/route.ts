import { NextRequest, NextResponse } from "next/server";
import { reportPayment, findOrderByNumberAndAccessCode } from "@/lib/db/orders";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { normalizeAccessCode } from "@/lib/utils";

export async function POST(request: NextRequest) {
  try {
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(
      `report-payment:${clientIp}`,
      5,
      60_000,
    );
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

    const { order_number, access_code, payment_amount, payment_last5 } =
      body as {
      order_number?: string;
      access_code?: string;
      payment_amount?: number;
      payment_last5?: string;
    };

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

    const existingOrder = await findOrderByNumberAndAccessCode(
      order_number.trim().toUpperCase(),
      normalizeAccessCode(access_code),
    );
    if (!existingOrder) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 },
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
      existingOrder.id,
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
