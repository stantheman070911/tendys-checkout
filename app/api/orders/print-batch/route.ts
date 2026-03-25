import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/auth/supabase-admin";
import { getConfirmedShipmentPrintOrdersByIds } from "@/lib/db/orders";
import {
  parseJsonBody,
  requiredTrimmedStringSchema,
  z,
} from "@/lib/validation";

const MAX_PRINT_BATCH_SIZE = 50;
const printBatchSchema = z
  .object({
    roundId: requiredTrimmedStringSchema("roundId"),
    orderIds: z.array(z.string()).min(1, {
      message: "orderIds must be a non-empty array of strings",
    }),
  })
  .transform((value) => ({
    roundId: value.roundId,
    orderIds: Array.from(
      new Set(value.orderIds.map((id) => id.trim()).filter(Boolean)),
    ),
  }))
  .superRefine((value, context) => {
    if (value.orderIds.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "orderIds must be a non-empty array of strings",
      });
    }
  });

export async function POST(request: NextRequest) {
  try {
    const isAdmin = await verifyAdminSession(request);
    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsedBody = await parseJsonBody(request, printBatchSchema);
    if (!parsedBody.success) {
      return parsedBody.response;
    }

    const { roundId, orderIds: trimmedIds } = parsedBody.data;
    if (trimmedIds.length > MAX_PRINT_BATCH_SIZE) {
      return NextResponse.json(
        {
          error: `print batch is limited to ${MAX_PRINT_BATCH_SIZE} orders`,
        },
        { status: 400 },
      );
    }

    const orders = await getConfirmedShipmentPrintOrdersByIds(
      roundId,
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
