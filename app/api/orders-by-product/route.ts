import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/auth/supabase-admin";
import { getOrdersByProduct } from "@/lib/db/orders";
import {
  parseSearchParams,
  requiredTrimmedStringSchema,
  z,
} from "@/lib/validation";

const ordersByProductQuerySchema = z.object({
  productId: requiredTrimmedStringSchema("productId"),
  roundId: requiredTrimmedStringSchema("roundId"),
});

export async function GET(request: NextRequest) {
  try {
    const isAdmin = await verifyAdminSession(request);
    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsedQuery = parseSearchParams(
      request.nextUrl.searchParams,
      ordersByProductQuerySchema,
    );
    if (!parsedQuery.success) {
      return parsedQuery.response;
    }

    const customers = await getOrdersByProduct(
      parsedQuery.data.productId,
      parsedQuery.data.roundId,
    );

    return NextResponse.json({ customers });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
