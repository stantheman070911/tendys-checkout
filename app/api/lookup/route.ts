import { NextRequest, NextResponse } from "next/server";
import { handleEnvironmentConfigurationError } from "@/lib/api/errors";
import { findOrdersByPurchaserNameAndPhoneLast3 } from "@/lib/db/orders";
import { getRequestId, getRouteFromRequest } from "@/lib/logger";
import { createPublicOrderAccessDetailUrl } from "@/lib/public-order-access";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import {
  getPublicOrderAccessSecret,
} from "@/lib/server-env";
import { normalizePhoneDigits } from "@/lib/utils";
import { parseJsonBody, z } from "@/lib/validation";

const lookupSchema = z
  .object({
    purchaser_name: z.string().optional(),
    recipient_name: z.string().optional(),
    phone_last3: z.string().optional(),
  })
  .transform((value) => ({
    purchaserName: value.purchaser_name?.trim() || value.recipient_name?.trim() || "",
    phoneLast3: normalizePhoneDigits(value.phone_last3),
  }))
  .superRefine((value, context) => {
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
    const rateLimit = await checkRateLimit(`lookup:${clientIp}`, 5, 60_000, {
      route: getRouteFromRequest(request),
      requestId: getRequestId(request),
    });
    if (rateLimit.error === "backend_unavailable") {
      return NextResponse.json(
        { error: "Lookup is temporarily unavailable" },
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

    getPublicOrderAccessSecret();

    const parsedBody = await parseJsonBody(request, lookupSchema);
    if (!parsedBody.success) {
      return parsedBody.response;
    }
    const { purchaserName, phoneLast3 } = parsedBody.data;

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
      detail_url: createPublicOrderAccessDetailUrl({
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
    }));

    return NextResponse.json({ orders: safeOrders });
  } catch (error) {
    const response = handleEnvironmentConfigurationError(
      request,
      error,
      "Lookup is temporarily unavailable",
    );
    if (response) {
      return response;
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
