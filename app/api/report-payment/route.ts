import { NextRequest, NextResponse } from "next/server";
import {
  findPublicOrderByOrderNumberAndIdentity,
  reportPayment,
} from "@/lib/db/orders";
import { getRequestId, getRouteFromRequest, logError } from "@/lib/logger";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { normalizePhoneDigits } from "@/lib/utils";
import { parseJsonBody, z } from "@/lib/validation";

const reportPaymentSchema = z
  .object({
    order_number: z.string().optional(),
    purchaser_name: z.string().optional(),
    recipient_name: z.string().optional(),
    phone_last3: z.string().optional(),
    payment_amount: z.any().optional(),
    payment_last5: z.any().optional(),
  })
  .transform((value) => ({
    orderNumber: value.order_number?.trim().toUpperCase() ?? "",
    purchaserName:
      value.purchaser_name?.trim() || value.recipient_name?.trim() || "",
    phoneLast3: normalizePhoneDigits(value.phone_last3),
    paymentAmount: value.payment_amount,
    paymentLast5: value.payment_last5,
  }))
  .superRefine((value, context) => {
    if (!value.orderNumber) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "order_number is required",
      });
    }

    if (!value.purchaserName) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "purchaser_name is required",
      });
    }

    if (value.phoneLast3.length !== 3) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "phone_last3 must be exactly 3 digits",
      });
    }
  });

export async function POST(request: NextRequest) {
  try {
    const clientIp = getClientIp(request);
    const rateLimit = await checkRateLimit(
      `report-payment:${clientIp}`,
      5,
      60_000,
      {
        route: getRouteFromRequest(request),
        requestId: getRequestId(request),
      },
    );
    if (rateLimit.error === "backend_unavailable") {
      return NextResponse.json(
        { error: "Payment reporting is temporarily unavailable" },
        { status: 503 },
      );
    }
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        {
          status: 429,
          headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
        },
      );
    }

    const parsedBody = await parseJsonBody(request, reportPaymentSchema);
    if (!parsedBody.success) {
      return parsedBody.response;
    }
    const {
      orderNumber,
      purchaserName,
      phoneLast3,
      paymentAmount: payment_amount,
      paymentLast5: payment_last5,
    } = parsedBody.data;

    const existingOrder = await findPublicOrderByOrderNumberAndIdentity(
      orderNumber,
      purchaserName,
      phoneLast3,
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
  } catch (error) {
    logError({
      event: "report_payment_failed",
      requestId: getRequestId(request),
      route: getRouteFromRequest(request),
      error,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
