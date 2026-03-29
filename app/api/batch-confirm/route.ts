import { NextRequest, NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/auth/supabase-admin";
import { batchConfirm } from "@/lib/db/orders";
import { getRequestId, getRouteFromRequest, logError } from "@/lib/logger";
import { parseJsonBody, uuidStringSchema, z } from "@/lib/validation";

const batchConfirmSchema = z.object({
  orderIds: z
    .array(uuidStringSchema("orderId"))
    .min(1, { message: "orderIds must be a non-empty array of UUIDs" }),
});

export async function POST(request: NextRequest) {
  let authMode: "cookie" | "bearer" | "none" = "none";

  try {
    const authorization = await authorizeAdminRequest(request);
    authMode = authorization.mode;
    if (!authorization.authorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsedBody = await parseJsonBody(request, batchConfirmSchema);
    if (!parsedBody.success) {
      return parsedBody.response;
    }

    const trimmedIds = parsedBody.data.orderIds;
    const confirmedOrders = await batchConfirm(trimmedIds);
    const changedIds = new Set(confirmedOrders.map((order) => order.id));
    const skipped = trimmedIds.filter((id) => !changedIds.has(id));

    return NextResponse.json({
      confirmed: confirmedOrders.length,
      skipped,
    });
  } catch (error) {
    logError({
      event: "batch_confirm_failed",
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
