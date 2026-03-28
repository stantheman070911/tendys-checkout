import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/auth/supabase-admin";
import {
  getOpenRound,
  create,
  update,
  listRecent,
  findById,
} from "@/lib/db/rounds";
import {
  DEFAULT_PICKUP_OPTION_A,
  DEFAULT_PICKUP_OPTION_B,
  validatePickupOptionLabels,
} from "@/lib/pickup-options";
import {
  nonNegativeIntegerOrNullSchema,
  parseJsonBody,
  requiredTrimmedStringSchema,
  uuidStringSchema,
  z,
} from "@/lib/validation";

const PUBLIC_CACHE_CONTROL = "public, s-maxage=30, stale-while-revalidate=60";

const roundCreateSchema = z.object({
  name: requiredTrimmedStringSchema("name"),
  deadline: z.union([z.string(), z.null(), z.undefined()]),
  shipping_fee: nonNegativeIntegerOrNullSchema("shipping_fee"),
  pickup_option_a: z.string().optional(),
  pickup_option_b: z.string().optional(),
});

const roundUpdateSchema = z.object({
  id: uuidStringSchema("id"),
  name: z
    .string()
    .transform((value) => value.trim())
    .pipe(z.string().min(1, { message: "name cannot be blank" }))
    .optional(),
  is_open: z.boolean().optional(),
  deadline: z.union([z.string(), z.null(), z.undefined()]).optional(),
  shipping_fee: nonNegativeIntegerOrNullSchema("shipping_fee"),
  pickup_option_a: z.string().optional(),
  pickup_option_b: z.string().optional(),
});

// Public — storefront needs open round
export async function GET(request: NextRequest) {
  try {
    const all = request.nextUrl.searchParams.get("all");

    // Admin: list recent rounds
    if (all === "true") {
      const isAdmin = await verifyAdminSession(request);
      if (!isAdmin) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const rounds = await listRecent();
      return NextResponse.json({ rounds });
    }

    // Public: get current open round
    const round = await getOpenRound();
    return NextResponse.json(
      { round },
      {
        headers: {
          "Cache-Control": PUBLIC_CACHE_CONTROL,
        },
      },
    );
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const isAdmin = await verifyAdminSession(request);
    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsedBody = await parseJsonBody(request, roundCreateSchema);
    if (!parsedBody.success) {
      return parsedBody.response;
    }

    const {
      name,
      deadline,
      shipping_fee,
      pickup_option_a,
      pickup_option_b,
    } = parsedBody.data;

    const pickupOptions = validatePickupOptionLabels(
      typeof pickup_option_a === "string"
        ? pickup_option_a
        : DEFAULT_PICKUP_OPTION_A,
      typeof pickup_option_b === "string"
        ? pickup_option_b
        : DEFAULT_PICKUP_OPTION_B,
    );
    if (!pickupOptions.ok) {
      return NextResponse.json(
        { error: pickupOptions.error },
        { status: 400 },
      );
    }

    const result = await create({
      name,
      deadline: deadline ?? undefined,
      shipping_fee: shipping_fee ?? undefined,
      pickup_option_a: pickupOptions.pickup_option_a,
      pickup_option_b: pickupOptions.pickup_option_b,
    });

    if (result && typeof result === "object" && "error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ round: result }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const isAdmin = await verifyAdminSession(request);
    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsedBody = await parseJsonBody(request, roundUpdateSchema);
    if (!parsedBody.success) {
      return parsedBody.response;
    }

    const { id, ...fields } = parsedBody.data;

    const data: Record<string, unknown> = {};
    if (typeof fields.name === "string") data.name = fields.name;
    if (typeof fields.is_open === "boolean") data.is_open = fields.is_open;
    if (fields.deadline !== undefined) data.deadline = fields.deadline;
    if (fields.shipping_fee !== undefined) {
      data.shipping_fee = fields.shipping_fee;
    }

    const wantsPickupOptionUpdate =
      fields.pickup_option_a !== undefined || fields.pickup_option_b !== undefined;
    if (wantsPickupOptionUpdate) {
      if (
        fields.pickup_option_a !== undefined &&
        typeof fields.pickup_option_a !== "string"
      ) {
        return NextResponse.json(
          { error: "pickup_option_a must be a string" },
          { status: 400 },
        );
      }
      if (
        fields.pickup_option_b !== undefined &&
        typeof fields.pickup_option_b !== "string"
      ) {
        return NextResponse.json(
          { error: "pickup_option_b must be a string" },
          { status: 400 },
        );
      }

      const existingRound = await findById(id);
      if (!existingRound) {
        return NextResponse.json({ error: "Round not found" }, { status: 404 });
      }

      const pickupOptions = validatePickupOptionLabels(
        fields.pickup_option_a ?? existingRound.pickup_option_a,
        fields.pickup_option_b ?? existingRound.pickup_option_b,
      );
      if (!pickupOptions.ok) {
        return NextResponse.json(
          { error: pickupOptions.error },
          { status: 400 },
        );
      }

      if (fields.pickup_option_a !== undefined) {
        data.pickup_option_a = pickupOptions.pickup_option_a;
      }
      if (fields.pickup_option_b !== undefined) {
        data.pickup_option_b = pickupOptions.pickup_option_b;
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "At least one field to update is required" },
        { status: 400 },
      );
    }

    const result = await update(
      id,
      data as Parameters<typeof update>[1],
    );
    if (result && typeof result === "object" && "error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ round: result });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
