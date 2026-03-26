import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/auth/supabase-admin";
import { getLogsByRound } from "@/lib/db/notification-logs";
import {
  parseSearchParams,
  uuidStringSchema,
  z,
} from "@/lib/validation";

const notificationLogsQuerySchema = z.object({
  roundId: uuidStringSchema("roundId"),
});

export async function GET(request: NextRequest) {
  try {
    const isAdmin = await verifyAdminSession(request);
    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsedQuery = parseSearchParams(
      request.nextUrl.searchParams,
      notificationLogsQuerySchema,
    );
    if (!parsedQuery.success) {
      return parsedQuery.response;
    }

    const logs = await getLogsByRound(parsedQuery.data.roundId);
    return NextResponse.json({ logs });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
