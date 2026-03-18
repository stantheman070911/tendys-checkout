// POST /api/orders/:id/notify
// Called by your admin panel to push a shipping notification to the buyer's LINE.
//
// Body: { event: "SHIPPED", trackingNumber?: string }
//       { event: "DELIVERED" }
//
// Auth: Requires ADMIN_SECRET header (set ADMIN_SECRET in .env)

import { NextRequest, NextResponse } from "next/server";
import { notifyShipped, notifyDelivered } from "@/lib/line/notify";

type NotifyRequest = {
  event: "SHIPPED" | "DELIVERED";
  trackingNumber?: string; // only for SHIPPED
};

type ApiError = { error: string };

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    console.error("[notify] ADMIN_SECRET env var not set");
    return NextResponse.json<ApiError>({ error: "Server misconfigured" }, { status: 500 });
  }

  const authHeader = request.headers.get("Authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json<ApiError>({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Parse body ─────────────────────────────────────────────────────────
  let body: NotifyRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json<ApiError>({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.event || !["SHIPPED", "DELIVERED"].includes(body.event)) {
    return NextResponse.json<ApiError>(
      { error: "event must be SHIPPED or DELIVERED" },
      { status: 400 }
    );
  }

  // ── Dispatch ──────────────────────────────────────────────────────────────
  const orderId = params.id;
  let success: boolean;

  if (body.event === "SHIPPED") {
    success = await notifyShipped({ orderId, trackingNumber: body.trackingNumber });
  } else {
    success = await notifyDelivered(orderId);
  }

  if (!success) {
    return NextResponse.json<ApiError>(
      { error: "Notification failed — order may not have a linked LINE user, or order not found" },
      { status: 422 }
    );
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
