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

const PUBLIC_CACHE_CONTROL = "public, s-maxage=30, stale-while-revalidate=60";

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

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const { name, deadline, shipping_fee, pickup_option_a, pickup_option_b } =
      body as {
      name?: string;
      deadline?: string | null;
      shipping_fee?: number | null;
      pickup_option_a?: string;
      pickup_option_b?: string;
    };

    const trimmedName = typeof name === "string" ? name.trim() : "";
    if (!trimmedName) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    if (
      shipping_fee !== undefined &&
      shipping_fee !== null &&
      (typeof shipping_fee !== "number" ||
        !Number.isInteger(shipping_fee) ||
        shipping_fee < 0)
    ) {
      return NextResponse.json(
        { error: "shipping_fee must be a non-negative integer or null" },
        { status: 400 },
      );
    }

    if (pickup_option_a !== undefined && typeof pickup_option_a !== "string") {
      return NextResponse.json(
        { error: "pickup_option_a must be a string" },
        { status: 400 },
      );
    }

    if (pickup_option_b !== undefined && typeof pickup_option_b !== "string") {
      return NextResponse.json(
        { error: "pickup_option_b must be a string" },
        { status: 400 },
      );
    }

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
      name: trimmedName,
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

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const { id, ...fields } = body as {
      id?: string;
      name?: string;
      is_open?: boolean;
      deadline?: string | null;
      shipping_fee?: number | null;
      pickup_option_a?: string;
      pickup_option_b?: string;
    };

    if (!id || typeof id !== "string" || !id.trim()) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    if (typeof fields.name === "string") data.name = fields.name.trim();
    if (typeof fields.is_open === "boolean") data.is_open = fields.is_open;
    if (fields.deadline !== undefined) data.deadline = fields.deadline;
    if (fields.shipping_fee !== undefined) {
      if (
        fields.shipping_fee !== null &&
        (typeof fields.shipping_fee !== "number" ||
          !Number.isInteger(fields.shipping_fee) ||
          fields.shipping_fee < 0)
      ) {
        return NextResponse.json(
          { error: "shipping_fee must be a non-negative integer or null" },
          { status: 400 },
        );
      }
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

      const existingRound = await findById(id.trim());
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
      id.trim(),
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
