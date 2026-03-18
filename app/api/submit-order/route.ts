import { NextRequest, NextResponse } from "next/server";
import { upsertByNickname } from "@/lib/db/users";
import { createWithItems } from "@/lib/db/orders";
import { PICKUP_OPTIONS } from "@/constants";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const validPickupValues = new Set(PICKUP_OPTIONS.map((o) => o.value));

export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const {
      round_id,
      nickname,
      recipient_name,
      phone,
      address,
      email,
      pickup_location,
      items,
      submission_key,
      note,
    } = body as {
      round_id?: string;
      nickname?: string;
      recipient_name?: string;
      phone?: string;
      address?: string;
      email?: string;
      pickup_location?: string;
      items?: Array<{
        product_id?: string;
        product_name?: string;
        unit_price?: number;
        quantity?: number;
        subtotal?: number;
      }>;
      submission_key?: string;
      note?: string;
    };

    // ─── Validation ──────────────────────────────────────────

    if (
      !submission_key ||
      typeof submission_key !== "string" ||
      !UUID_RE.test(submission_key)
    ) {
      return NextResponse.json(
        { error: "submission_key must be a valid UUID" },
        { status: 400 }
      );
    }

    if (!round_id || typeof round_id !== "string" || !round_id.trim()) {
      return NextResponse.json({ error: "round_id is required" }, { status: 400 });
    }

    const trimmedNickname = typeof nickname === "string" ? nickname.trim() : "";
    if (!trimmedNickname) {
      return NextResponse.json({ error: "nickname is required" }, { status: 400 });
    }

    const trimmedRecipientName =
      typeof recipient_name === "string" ? recipient_name.trim() : "";
    if (!trimmedRecipientName) {
      return NextResponse.json(
        { error: "recipient_name is required" },
        { status: 400 }
      );
    }

    const trimmedPhone = typeof phone === "string" ? phone.trim() : "";
    if (!trimmedPhone) {
      return NextResponse.json({ error: "phone is required" }, { status: 400 });
    }

    // pickup_location: empty string = 宅配, or a named option
    const pickupValue =
      typeof pickup_location === "string" ? pickup_location : "";
    if (!validPickupValues.has(pickupValue)) {
      return NextResponse.json(
        { error: "Invalid pickup_location" },
        { status: 400 }
      );
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "items must be a non-empty array" },
        { status: 400 }
      );
    }

    // Validate each item
    for (const item of items) {
      if (
        !item.product_id ||
        typeof item.product_id !== "string" ||
        !item.product_id.trim()
      ) {
        return NextResponse.json(
          { error: "Each item must have a product_id" },
          { status: 400 }
        );
      }
      if (
        !item.product_name ||
        typeof item.product_name !== "string" ||
        !item.product_name.trim()
      ) {
        return NextResponse.json(
          { error: "Each item must have a product_name" },
          { status: 400 }
        );
      }
      if (
        typeof item.unit_price !== "number" ||
        !Number.isInteger(item.unit_price) ||
        item.unit_price <= 0
      ) {
        return NextResponse.json(
          { error: "Each item must have a positive integer unit_price" },
          { status: 400 }
        );
      }
      if (
        typeof item.quantity !== "number" ||
        !Number.isInteger(item.quantity) ||
        item.quantity <= 0
      ) {
        return NextResponse.json(
          { error: "Each item must have a positive integer quantity" },
          { status: 400 }
        );
      }
      if (
        typeof item.subtotal !== "number" ||
        !Number.isInteger(item.subtotal) ||
        item.subtotal <= 0
      ) {
        return NextResponse.json(
          { error: "Each item must have a positive integer subtotal" },
          { status: 400 }
        );
      }
    }

    // ─── Upsert user ────────────────────────────────────────

    const user = await upsertByNickname(trimmedNickname, {
      recipient_name: trimmedRecipientName,
      phone: trimmedPhone,
      address: typeof address === "string" ? address.trim() : undefined,
      email: typeof email === "string" ? email.trim() : undefined,
    });

    // ─── Create order ───────────────────────────────────────

    const orderItems = items.map((item) => ({
      product_id: item.product_id!.trim(),
      product_name: item.product_name!.trim(),
      unit_price: item.unit_price!,
      quantity: item.quantity!,
      subtotal: item.subtotal!,
    }));

    const result = await createWithItems(
      {
        round_id: round_id.trim(),
        user_id: user.id,
        pickup_location: pickupValue,
        note: typeof note === "string" ? note.trim() || undefined : undefined,
      },
      orderItems,
      submission_key
    );

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(
      { order: result.order },
      { status: result.deduplicated ? 200 : 201 }
    );
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
