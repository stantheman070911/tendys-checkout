import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/auth/supabase-admin";
import { prisma } from "@/lib/db/prisma";
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

    const { productId, roundId, productName } = body as {
      productId?: string;
      roundId?: string;
      productName?: string;
    };

    if (!productId || typeof productId !== "string" || !productId.trim()) {
      return NextResponse.json({ error: "productId is required" }, { status: 400 });
    }
    if (!roundId || typeof roundId !== "string" || !roundId.trim()) {
      return NextResponse.json({ error: "roundId is required" }, { status: 400 });
    }
    if (!productName || typeof productName !== "string" || !productName.trim()) {
      return NextResponse.json(
        { error: "productName is required" },
        { status: 400 }
      );
    }

    // Query order items with user emails (getOrdersByProduct doesn't include email)
    const items = await prisma.orderItem.findMany({
      where: {
        product_id: productId.trim(),
        order: {
          round_id: roundId.trim(),
          status: { not: "cancelled" },
        },
      },
      include: {
        order: { include: { user: true } },
      },
    });

    // Deduplicate customers by user_id
    const seen = new Set<string>();
    const customers: Array<{ email?: string | null; orderId?: string | null }> =
      [];

    for (const item of items) {
      const userId = item.order.user_id;
      if (!userId || seen.has(userId)) continue;
      seen.add(userId);
      customers.push({
        email: item.order.user?.email ?? null,
        orderId: item.order.id,
      });
    }

    if (customers.length === 0) {
      return NextResponse.json({ customersNotified: 0 });
    }

    const result = await sendProductArrivalNotifications(
      productName.trim(),
      customers
    );

    return NextResponse.json({
      customersNotified: customers.length,
      line: result.line,
      emailResults: result.emailResults,
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
