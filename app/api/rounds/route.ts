import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/auth/supabase-admin";
import {
  getOpenRound,
  create,
  update,
  listRecent,
} from "@/lib/db/rounds";

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
    return NextResponse.json({ round });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
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

    const { name, deadline, shipping_fee } = body as {
      name?: string;
      deadline?: string | null;
      shipping_fee?: number | null;
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
        { status: 400 }
      );
    }

    const round = await create({
      name: trimmedName,
      deadline: deadline ?? undefined,
      shipping_fee: shipping_fee ?? undefined,
    });

    return NextResponse.json({ round }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
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
          { status: 400 }
        );
      }
      data.shipping_fee = fields.shipping_fee;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "At least one field to update is required" },
        { status: 400 }
      );
    }

    const round = await update(id.trim(), data as Parameters<typeof update>[1]);
    return NextResponse.json({ round });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
