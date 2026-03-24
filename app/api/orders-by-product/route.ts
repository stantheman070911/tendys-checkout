import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/auth/supabase-admin";
import { getOrdersByProduct } from "@/lib/db/orders";

export async function GET(request: NextRequest) {
  try {
    const isAdmin = await verifyAdminSession(request);
    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const productId = request.nextUrl.searchParams.get("productId");
    const roundId = request.nextUrl.searchParams.get("roundId");

    if (!productId || !productId.trim()) {
      return NextResponse.json(
        { error: "productId is required" },
        { status: 400 },
      );
    }
    if (!roundId || !roundId.trim()) {
      return NextResponse.json(
        { error: "roundId is required" },
        { status: 400 },
      );
    }

    const customers = await getOrdersByProduct(
      productId.trim(),
      roundId.trim(),
    );

    return NextResponse.json({ customers });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
