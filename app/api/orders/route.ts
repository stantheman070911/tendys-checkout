import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/auth/supabase-admin";
import { listPageByRound } from "@/lib/db/orders";
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

    const search = request.nextUrl.searchParams.get("q") || undefined;
    const productId = request.nextUrl.searchParams.get("productId") || undefined;
    const page = Math.max(
      1,
      Number.parseInt(request.nextUrl.searchParams.get("page") ?? "1", 10) || 1,
    );
    const pageSize = Math.min(
      100,
      Math.max(
        1,
        Number.parseInt(request.nextUrl.searchParams.get("pageSize") ?? "50", 10) ||
          50,
      ),
    );

    const result = await listPageByRound({
      roundId: roundId.trim(),
      status,
      search,
      productId,
      page,
      pageSize,
    });

    return NextResponse.json({
      items: result.items,
      orders: result.items,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      hasMore: result.hasMore,
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
