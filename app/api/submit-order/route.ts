import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/auth/supabase-admin";
import { createCheckoutOrder } from "@/lib/db/orders";
import {
  buildPublicOrderAccessPath,
  createPublicOrderAccessToken,
} from "@/lib/public-order-access";
import { getPhoneLast3 } from "@/lib/utils";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PHONE_RE = /^[\d\-+().\s]{7,20}$/;

const MAX_LEN = {
  nickname: 50,
  purchaser_name: 100,
  recipient_name: 100,
  phone: 20,
  address: 200,
  email: 254,
  note: 500,
} as const;

export async function POST(request: NextRequest) {
  try {
    const isAdmin = await verifyAdminSession(request);
    if (!isAdmin) {
      const clientIp = getClientIp(request);
      const rateLimit = checkRateLimit(`submit-order:${clientIp}`, 5, 60_000);
      if (!rateLimit.allowed) {
        return NextResponse.json(
          { error: "Too many requests" },
          {
            status: 429,
            headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
          },
        );
      }
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const {
      round_id,
      nickname,
      purchaser_name,
      recipient_name,
      phone,
      address,
      email,
      pickup_location,
      items,
      submission_key,
      note,
      save_profile,
    } = body as {
      round_id?: string;
      nickname?: string;
      purchaser_name?: string;
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
      save_profile?: boolean;
    };

    // ─── Validation ──────────────────────────────────────────

    if (
      !submission_key ||
      typeof submission_key !== "string" ||
      !UUID_RE.test(submission_key)
    ) {
      return NextResponse.json(
        { error: "submission_key must be a valid UUID" },
        { status: 400 },
      );
    }

    const trimmedRoundId = typeof round_id === "string" ? round_id.trim() : "";
    if (!trimmedRoundId) {
      return NextResponse.json(
        { error: "round_id is required" },
        { status: 400 },
      );
    }
    if (!UUID_RE.test(trimmedRoundId)) {
      return NextResponse.json(
        { error: "round_id must be a valid UUID" },
        { status: 400 },
      );
    }

    const trimmedNickname = typeof nickname === "string" ? nickname.trim() : "";
    if (!trimmedNickname) {
      return NextResponse.json(
        { error: "nickname is required" },
        { status: 400 },
      );
    }
    if (trimmedNickname.length > MAX_LEN.nickname) {
      return NextResponse.json(
        { error: `nickname must be ≤ ${MAX_LEN.nickname} chars` },
        { status: 400 },
      );
    }

    const trimmedPurchaserName =
      typeof purchaser_name === "string"
        ? purchaser_name.trim()
        : typeof recipient_name === "string"
          ? recipient_name.trim()
          : "";
    if (!trimmedPurchaserName) {
      return NextResponse.json(
        { error: "purchaser_name is required" },
        { status: 400 },
      );
    }
    if (trimmedPurchaserName.length > MAX_LEN.purchaser_name) {
      return NextResponse.json(
        { error: `purchaser_name must be ≤ ${MAX_LEN.purchaser_name} chars` },
        { status: 400 },
      );
    }

    const trimmedRecipientName =
      typeof recipient_name === "string" ? recipient_name.trim() : "";
    if (!trimmedRecipientName) {
      return NextResponse.json(
        { error: "recipient_name is required" },
        { status: 400 },
      );
    }
    if (trimmedRecipientName.length > MAX_LEN.recipient_name) {
      return NextResponse.json(
        { error: `recipient_name must be ≤ ${MAX_LEN.recipient_name} chars` },
        { status: 400 },
      );
    }

    const trimmedPhone = typeof phone === "string" ? phone.trim() : "";
    if (!trimmedPhone) {
      return NextResponse.json({ error: "phone is required" }, { status: 400 });
    }
    if (!PHONE_RE.test(trimmedPhone)) {
      return NextResponse.json(
        { error: "phone format is invalid" },
        { status: 400 },
      );
    }

    // pickup_location: empty string = 宅配, or a named option
    if (
      pickup_location !== undefined &&
      typeof pickup_location !== "string"
    ) {
      return NextResponse.json(
        { error: "pickup_location must be a string" },
        { status: 400 },
      );
    }
    const pickupValue =
      typeof pickup_location === "string" ? pickup_location.trim() : "";

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "items must be a non-empty array" },
        { status: 400 },
      );
    }

    // Validate each item and check for duplicates
    const seenProducts = new Set<string>();
    for (const item of items) {
      const productId =
        typeof item.product_id === "string" ? item.product_id.trim() : "";
      if (!productId) {
        return NextResponse.json(
          { error: "Each item must have a product_id" },
          { status: 400 },
        );
      }
      if (!UUID_RE.test(productId)) {
        return NextResponse.json(
          { error: "Each item must have a valid product_id" },
          { status: 400 },
        );
      }
      if (seenProducts.has(productId)) {
        return NextResponse.json(
          { error: "Duplicate products in order items" },
          { status: 400 },
        );
      }
      seenProducts.add(productId);

      if (
        typeof item.quantity !== "number" ||
        !Number.isInteger(item.quantity) ||
        item.quantity <= 0
      ) {
        return NextResponse.json(
          { error: "Each item must have a positive integer quantity" },
          { status: 400 },
        );
      }
    }

    // ─── Optional/conditional field checks ────────────────────

    const isDelivery = pickupValue === "";
    const trimmedAddress =
      typeof address === "string" ? address.trim() : undefined;

    if (isDelivery && !trimmedAddress) {
      return NextResponse.json(
        { error: "address is required for delivery" },
        { status: 400 },
      );
    }

    if (trimmedAddress && trimmedAddress.length > MAX_LEN.address) {
      return NextResponse.json(
        { error: `address must be ≤ ${MAX_LEN.address} chars` },
        { status: 400 },
      );
    }

    const trimmedEmail = typeof email === "string" ? email.trim() : undefined;
    if (trimmedEmail && trimmedEmail.length > MAX_LEN.email) {
      return NextResponse.json(
        { error: `email must be ≤ ${MAX_LEN.email} chars` },
        { status: 400 },
      );
    }
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      return NextResponse.json(
        { error: "email format is invalid" },
        { status: 400 },
      );
    }

    const trimmedNote =
      typeof note === "string" ? note.trim() || undefined : undefined;
    if (trimmedNote && trimmedNote.length > MAX_LEN.note) {
      return NextResponse.json(
        { error: `note must be ≤ ${MAX_LEN.note} chars` },
        { status: 400 },
      );
    }

    // ─── Create order ───────────────────────────────────────

    const orderItems = items.map((item) => ({
      product_id: item.product_id!.trim(),
      quantity: item.quantity!,
    }));
    const shouldSaveProfile = save_profile === true;

    const result = await createCheckoutOrder({
      round_id: trimmedRoundId,
      pickup_location: pickupValue,
      note: trimmedNote,
      submission_key,
      items: orderItems,
      is_admin: isAdmin,
      save_profile: shouldSaveProfile,
      user: {
        nickname: trimmedNickname,
        purchaser_name: trimmedPurchaserName,
        recipient_name: trimmedRecipientName,
        phone: trimmedPhone,
        address: trimmedAddress,
        email: trimmedEmail,
      },
    });

    switch (result.kind) {
      case "success": {
        const access_token = createPublicOrderAccessToken({
          orderNumber: result.order.order_number,
          purchaserName: trimmedPurchaserName,
          phoneLast3: getPhoneLast3(trimmedPhone),
        });
        return NextResponse.json(
          {
            order: result.order,
            access_token,
            detail_url: buildPublicOrderAccessPath(access_token),
          },
          { status: result.deduplicated ? 200 : 201 },
        );
      }
      case "validation_error":
        return NextResponse.json({ error: result.error }, { status: 400 });
      case "saved_profile_phone_mismatch":
        return NextResponse.json(
          {
            error:
              "此暱稱已有資料儲存；電話一致才可自動帶入或覆寫更新。若要直接下單，請取消勾選儲存資料或改用其他暱稱。",
          },
          { status: 409 },
        );
      case "schema_drift_access_code":
        console.error(
          "POST /api/submit-order blocked by schema drift: apply prisma/migration_007_remove_access_code.sql to the target database.",
        );
        return NextResponse.json(
          {
            error:
              "Ordering is temporarily unavailable while the database migration is being applied. Please try again shortly.",
          },
          { status: 503 },
        );
    }
  } catch (error) {
    console.error("POST /api/submit-order failed", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
