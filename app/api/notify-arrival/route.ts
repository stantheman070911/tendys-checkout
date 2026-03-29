import { NextRequest, NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/auth/supabase-admin";
import { findById as findProductById } from "@/lib/db/products";
import { getCustomersForArrivalNotification } from "@/lib/db/orders";
import { getRequestId, getRouteFromRequest, logError } from "@/lib/logger";
import { enqueueProductArrivalNotifications } from "@/lib/notifications/outbox";
import { parseJsonBody, uuidStringSchema, z } from "@/lib/validation";

const notifyArrivalSchema = z.object({
  productId: uuidStringSchema("productId"),
  roundId: uuidStringSchema("roundId"),
});

export async function POST(request: NextRequest) {
  let authMode: "cookie" | "bearer" | "none" = "none";

  try {
    const authorization = await authorizeAdminRequest(request);
    authMode = authorization.mode;
    if (!authorization.authorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsedBody = await parseJsonBody(request, notifyArrivalSchema);
    if (!parsedBody.success) {
      return parsedBody.response;
    }
    const { productId: trimmedProductId, roundId: trimmedRoundId } =
      parsedBody.data;

    const product = await findProductById(trimmedProductId);
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    if (product.round_id !== trimmedRoundId) {
      return NextResponse.json(
        { error: "Product does not belong to this round" },
        { status: 400 },
      );
    }

    const recipients = await getCustomersForArrivalNotification(
      trimmedProductId,
      trimmedRoundId,
    );

    if (recipients.customerCount === 0) {
      return NextResponse.json({
        customersNotified: 0,
        queued: false,
      });
    }

    await enqueueProductArrivalNotifications({
      productId: product.id,
      productName: product.name,
      roundId: trimmedRoundId,
      lineUserIds: recipients.lineUserIds,
      emails: recipients.emails,
    });

    return NextResponse.json({
      customersNotified: recipients.customerCount,
      queued: true,
    });
  } catch (error) {
    logError({
      event: "notify_arrival_failed",
      requestId: getRequestId(request),
      route: getRouteFromRequest(request),
      authMode,
      error,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
