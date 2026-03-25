import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/auth/supabase-admin";
import { getConfirmedShipmentPrintOrdersByIds } from "@/lib/db/orders";

const MAX_PRINT_BATCH_SIZE = 50;

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

    const { orderIds, roundId } = body as {
      orderIds?: string[];
      roundId?: string;
    };
    const trimmedRoundId = typeof roundId === "string" ? roundId.trim() : "";

    if (!trimmedRoundId) {
      return NextResponse.json(
        { error: "roundId is required" },
        { status: 400 },
      );
    }

    if (
      !Array.isArray(orderIds) ||
      orderIds.length === 0 ||
      !orderIds.every((id) => typeof id === "string" && id.trim())
    ) {
      return NextResponse.json(
        { error: "orderIds must be a non-empty array of strings" },
        { status: 400 },
      );
    }

    const trimmedIds = Array.from(
      new Set(orderIds.map((id) => id.trim()).filter(Boolean)),
    );
    if (trimmedIds.length > MAX_PRINT_BATCH_SIZE) {
      return NextResponse.json(
        {
          error: `print batch is limited to ${MAX_PRINT_BATCH_SIZE} orders`,
        },
        { status: 400 },
      );
    }

    const orders = await getConfirmedShipmentPrintOrdersByIds(
      trimmedRoundId,
      trimmedIds,
    );
    if (orders.length !== trimmedIds.length) {
      return NextResponse.json(
        {
          error:
            "One or more shipment orders were not found for this round",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({ orders });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
