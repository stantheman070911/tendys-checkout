// POST /api/orders
// Called when user submits the group-chat purchase form.
// Creates the order, generates an 8-char code, returns it to the frontend.

import { NextRequest, NextResponse } from "next/server";
import { createOrder, createCode } from "@/lib/db/order";
import { generateCode } from "@/lib/auth/generate-code";

// How long the code stays valid (hours). Set ORDER_CODE_TTL_HOURS in .env to override.
const DEFAULT_CODE_TTL_HOURS = 48;

export type CreateOrderRequest = {
  name: string;             // Buyer name
  phone?: string;           // Optional contact phone
  items: Array<{
    name: string;
    qty: number;
    price: number;
  }>;
  note?: string;
};

export type CreateOrderResponse = {
  orderId: string;
  orderCode: string;        // 8-char code to paste into LINE
};

export type ApiError = {
  error: string;
};

export async function POST(request: NextRequest) {
  // ── Parse body ────────────────────────────────────────────────────────────
  let body: CreateOrderRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json<ApiError>({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { name, phone, items, note } = body;

  // ── Validate ──────────────────────────────────────────────────────────────
  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json<ApiError>({ error: "name is required" }, { status: 400 });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json<ApiError>({ error: "items must be a non-empty array" }, { status: 400 });
  }

  for (const item of items) {
    if (!item.name || typeof item.qty !== "number" || typeof item.price !== "number") {
      return NextResponse.json<ApiError>(
        { error: "Each item must have name (string), qty (number), price (number)" },
        { status: 400 }
      );
    }
  }

  // ── Create order ──────────────────────────────────────────────────────────
  const order = await createOrder({
    name: name.trim(),
    phone: phone?.trim(),
    items,
    note: note?.trim(),
  });

  // ── Generate & persist code ───────────────────────────────────────────────
  const code = generateCode();
  const ttlHours =
    Number(process.env.ORDER_CODE_TTL_HOURS) || DEFAULT_CODE_TTL_HOURS;
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

  await createCode({ code, orderId: order.id, expiresAt });

  // ── Respond ───────────────────────────────────────────────────────────────
  // Frontend shows this code to the user with instructions to paste it into LINE.
  return NextResponse.json<CreateOrderResponse>(
    { orderId: order.id, orderCode: code },
    { status: 201 }
  );
}
