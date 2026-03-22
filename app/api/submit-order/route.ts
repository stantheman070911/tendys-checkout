import { NextRequest, NextResponse } from "next/server";
import { upsertByNickname } from "@/lib/db/users";
import { createWithItems } from "@/lib/db/orders";
import { PICKUP_OPTIONS } from "@/constants";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PHONE_RE = /^[\d\-+().\s]{7,20}$/;

const MAX_LEN = {
  nickname: 50,
  recipient_name: 100,
  phone: 20,
  address: 200,
  email: 254,
  note: 500,
} as const;

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
    if (trimmedNickname.length > MAX_LEN.nickname) {
      return NextResponse.json(
        { error: `nickname must be ≤ ${MAX_LEN.nickname} chars` },
        { status: 400 }
      );
    }

    const trimmedRecipientName =
      typeof recipient_name === "string" ? recipient_name.trim() : "";
    if (!trimmedRecipientName) {
      return NextResponse.json(
        { error: "recipient_name is required" },
        { status: 400 }
      );
    }
    if (trimmedRecipientName.length > MAX_LEN.recipient_name) {
      return NextResponse.json(
        { error: `recipient_name must be ≤ ${MAX_LEN.recipient_name} chars` },
        { status: 400 }
      );
    }

    const trimmedPhone = typeof phone === "string" ? phone.trim() : "";
    if (!trimmedPhone) {
      return NextResponse.json({ error: "phone is required" }, { status: 400 });
    }
    if (!PHONE_RE.test(trimmedPhone)) {
      return NextResponse.json(
        { error: "phone format is invalid" },
        { status: 400 }
      );
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

    // Validate each item and check for duplicates
    const seenProducts = new Set<string>();
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
      if (seenProducts.has(item.product_id)) {
        return NextResponse.json(
          { error: "Duplicate products in order items" },
          { status: 400 }
        );
      }
      seenProducts.add(item.product_id);

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
    }

    // ─── Optional/conditional field checks ────────────────────

    const isDelivery = pickupValue === "";
    const trimmedAddress = typeof address === "string" ? address.trim() : undefined;
    
    if (isDelivery && !trimmedAddress) {
      return NextResponse.json(
        { error: "address is required for delivery" },
        { status: 400 }
      );
    }
    
    if (trimmedAddress && trimmedAddress.length > MAX_LEN.address) {
      return NextResponse.json(
        { error: `address must be ≤ ${MAX_LEN.address} chars` },
        { status: 400 }
      );
    }

    const trimmedEmail = typeof email === "string" ? email.trim() : undefined;
    if (trimmedEmail && trimmedEmail.length > MAX_LEN.email) {
      return NextResponse.json(
        { error: `email must be ≤ ${MAX_LEN.email} chars` },
        { status: 400 }
      );
    }

    const trimmedNote = typeof note === "string" ? note.trim() || undefined : undefined;
    if (trimmedNote && trimmedNote.length > MAX_LEN.note) {
      return NextResponse.json(
        { error: `note must be ≤ ${MAX_LEN.note} chars` },
        { status: 400 }
      );
    }

    // ─── Upsert user ────────────────────────────────────────

    const user = await upsertByNickname(trimmedNickname, {
      recipient_name: trimmedRecipientName,
      phone: trimmedPhone,
      address: trimmedAddress,
      email: trimmedEmail,
    });

    // ─── Create order ───────────────────────────────────────

    const orderItems = items.map((item) => ({
      product_id: item.product_id!.trim(),
      quantity: item.quantity!,
    }));

    const result = await createWithItems(
      {
        round_id: round_id.trim(),
        user_id: user.id,
        pickup_location: pickupValue,
        note: trimmedNote,
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
