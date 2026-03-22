import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/auth/supabase-admin";
import { findById as findProductById } from "@/lib/db/products";
import { getCustomersForArrivalNotification } from "@/lib/db/orders";
import { sendProductArrivalNotifications } from "@/lib/notifications/send";

export async function POST(request: NextRequest) {
  try {
    const isAdmin = await verifyAdminSession(request);
    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const { productId, roundId } = body as {
      productId?: string;
      roundId?: string;
    };

    if (!productId || typeof productId !== "string" || !productId.trim()) {
      return NextResponse.json({ error: "productId is required" }, { status: 400 });
    }
    if (!roundId || typeof roundId !== "string" || !roundId.trim()) {
      return NextResponse.json({ error: "roundId is required" }, { status: 400 });
    }

    const product = await findProductById(productId.trim());
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const recipients = await getCustomersForArrivalNotification(
      productId.trim(),
      roundId.trim()
    );

    if (recipients.customerCount === 0) {
      return NextResponse.json({
        customersNotified: 0,
        line: { success: true },
        emailResults: [],
      });
    }

    const result = await sendProductArrivalNotifications(
      product.id,
      product.name,
      roundId.trim(),
      recipients
    );

    return NextResponse.json({
      customersNotified: recipients.customerCount,
      line: result.line,
      emailResults: result.emailResults,
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
