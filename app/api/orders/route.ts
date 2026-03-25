import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/auth/supabase-admin";
import { listPageByRound } from "@/lib/db/orders";
import { ORDER_STATUS } from "@/constants";
import {
  optionalTrimmedStringSchema,
  parseSearchParams,
  requiredTrimmedStringSchema,
  z,
} from "@/lib/validation";

const VALID_STATUSES: Set<string> = new Set(Object.values(ORDER_STATUS));
const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 50;

const ordersQuerySchema = z
  .object({
    roundId: requiredTrimmedStringSchema("roundId"),
    status: optionalTrimmedStringSchema(),
    q: optionalTrimmedStringSchema(),
    productId: optionalTrimmedStringSchema(),
    page: z.string().optional(),
    pageSize: z.string().optional(),
  })
  .transform((value) => ({
    roundId: value.roundId,
    status: value.status,
    search: value.q,
    productId: value.productId,
    page: Math.max(
      1,
      Number.parseInt(value.page?.trim() ?? String(DEFAULT_PAGE), 10) ||
        DEFAULT_PAGE,
    ),
    pageSize: Math.min(
      100,
      Math.max(
        1,
        Number.parseInt(
          value.pageSize?.trim() ?? String(DEFAULT_PAGE_SIZE),
          10,
        ) || DEFAULT_PAGE_SIZE,
      ),
    ),
  }))
  .superRefine((value, context) => {
    if (value.status && !VALID_STATUSES.has(value.status)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid status filter",
      });
    }
  });

export async function GET(request: NextRequest) {
  try {
    const isAdmin = await verifyAdminSession(request);
    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsedQuery = parseSearchParams(
      request.nextUrl.searchParams,
      ordersQuerySchema,
    );
    if (!parsedQuery.success) {
      return parsedQuery.response;
    }

    const result = await listPageByRound(parsedQuery.data);

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
