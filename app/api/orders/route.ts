import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/auth/supabase-admin";
import { listByRound } from "@/lib/db/orders";
import { ORDER_STATUS } from "@/constants";

const VALID_STATUSES: Set<string> = new Set(Object.values(ORDER_STATUS));

export async function GET(request: NextRequest) {
  try {
    const isAdmin = await verifyAdminSession(request);
    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const roundId = request.nextUrl.searchParams.get("roundId");
    if (!roundId || !roundId.trim()) {
      return NextResponse.json(
        { error: "roundId is required" },
        { status: 400 },
      );
    }

    const status = request.nextUrl.searchParams.get("status") || undefined;
    if (status && !VALID_STATUSES.has(status)) {
      return NextResponse.json(
        { error: "Invalid status filter" },
        { status: 400 },
      );
    }

    const orders = await listByRound(roundId.trim(), status);
    return NextResponse.json({ orders });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
