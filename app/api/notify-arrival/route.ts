import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/auth/supabase-admin";
import { findById as findProductById } from "@/lib/db/products";
import { getCustomersForArrivalNotification } from "@/lib/db/orders";
import { fireAndForget } from "@/lib/notifications/fire-and-forget";
import { sendProductArrivalNotifications } from "@/lib/notifications/send";
import { parseJsonBody, requiredTrimmedStringSchema, z } from "@/lib/validation";

const notifyArrivalSchema = z.object({
  productId: requiredTrimmedStringSchema("productId"),
  roundId: requiredTrimmedStringSchema("roundId"),
});

export async function POST(request: NextRequest) {
  try {
    const isAdmin = await verifyAdminSession(request);
    if (!isAdmin) {
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

    fireAndForget(() =>
      sendProductArrivalNotifications(
        product.id,
        product.name,
        trimmedRoundId,
        recipients,
      ),
    );

    return NextResponse.json({
      customersNotified: recipients.customerCount,
      queued: true,
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
