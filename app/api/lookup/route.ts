import { NextRequest, NextResponse } from "next/server";
import { findByNicknameOrOrderNumber } from "@/lib/db/orders";

export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.get("q")?.trim();

    if (!q) {
      return NextResponse.json({ error: "q is required" }, { status: 400 });
    }

    const orders = await findByNicknameOrOrderNumber(q);
    return NextResponse.json({ orders });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
