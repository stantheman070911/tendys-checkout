import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/auth/supabase-admin";
import {
  listActiveByRound,
  listAllByRound,
  create,
  update,
} from "@/lib/db/products";

// Public — storefront needs product list. Admin with ?all=true gets inactive products too.
export async function GET(request: NextRequest) {
  try {
    const roundId = request.nextUrl.searchParams.get("roundId");
    if (!roundId || !roundId.trim()) {
      return NextResponse.json(
        { error: "roundId is required" },
        { status: 400 },
      );
    }

    const all = request.nextUrl.searchParams.get("all") === "true";
    if (all) {
      const isAdmin = await verifyAdminSession(request);
      if (!isAdmin) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const products = await listAllByRound(roundId.trim());
      return NextResponse.json({ products });
    }

    const products = await listActiveByRound(roundId.trim());
    return NextResponse.json({ products });
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

    const {
      name,
      price,
      unit,
      round_id,
      supplier_id,
      stock,
      goal_qty,
      image_url,
    } = body as {
      name?: string;
      price?: number;
      unit?: string;
      round_id?: string;
      supplier_id?: string | null;
      stock?: number | null;
      goal_qty?: number | null;
      image_url?: string | null;
    };

    const trimmedName = typeof name === "string" ? name.trim() : "";
    if (!trimmedName) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    if (
      price === undefined ||
      typeof price !== "number" ||
      !Number.isInteger(price) ||
      price <= 0
    ) {
      return NextResponse.json(
        { error: "price must be a positive integer" },
        { status: 400 },
      );
    }

    const trimmedUnit = typeof unit === "string" ? unit.trim() : "";
    if (!trimmedUnit) {
      return NextResponse.json({ error: "unit is required" }, { status: 400 });
    }

    if (!round_id || typeof round_id !== "string" || !round_id.trim()) {
      return NextResponse.json(
        { error: "round_id is required" },
        { status: 400 },
      );
    }

    if (
      stock !== undefined &&
      stock !== null &&
      (typeof stock !== "number" || !Number.isInteger(stock) || stock < 0)
    ) {
      return NextResponse.json(
        { error: "stock must be a non-negative integer or null" },
        { status: 400 },
      );
    }

    if (
      goal_qty !== undefined &&
      goal_qty !== null &&
      (typeof goal_qty !== "number" ||
        !Number.isInteger(goal_qty) ||
        goal_qty <= 0)
    ) {
      return NextResponse.json(
        { error: "goal_qty must be a positive integer or null" },
        { status: 400 },
      );
    }

    const product = await create({
      name: trimmedName,
      price,
      unit: trimmedUnit,
      round_id: round_id.trim(),
      supplier_id:
        typeof supplier_id === "string" && supplier_id.trim()
          ? supplier_id.trim()
          : null,
      stock: stock ?? null,
      goal_qty: goal_qty ?? null,
      image_url:
        typeof image_url === "string" && image_url.trim()
          ? image_url.trim()
          : null,
    });

    return NextResponse.json({ product }, { status: 201 });
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
      price?: number;
      unit?: string;
      round_id?: string;
      supplier_id?: string | null;
      is_active?: boolean;
      stock?: number | null;
      goal_qty?: number | null;
      image_url?: string | null;
    };

    if (!id || typeof id !== "string" || !id.trim()) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    // Build update data, validating each field if present
    const data: Record<string, unknown> = {};

    if (typeof fields.name === "string") {
      const v = fields.name.trim();
      if (!v)
        return NextResponse.json(
          { error: "name cannot be empty" },
          { status: 400 },
        );
      data.name = v;
    }
    if (typeof fields.price === "number") {
      if (!Number.isInteger(fields.price) || fields.price <= 0) {
        return NextResponse.json(
          { error: "price must be a positive integer" },
          { status: 400 },
        );
      }
      data.price = fields.price;
    }
    if (typeof fields.unit === "string") {
      const v = fields.unit.trim();
      if (!v)
        return NextResponse.json(
          { error: "unit cannot be empty" },
          { status: 400 },
        );
      data.unit = v;
    }
    if (typeof fields.round_id === "string")
      data.round_id = fields.round_id.trim();
    if (fields.supplier_id !== undefined) {
      if (
        fields.supplier_id !== null &&
        (typeof fields.supplier_id !== "string" || !fields.supplier_id.trim())
      ) {
        return NextResponse.json(
          { error: "supplier_id must be a non-empty string or null" },
          { status: 400 },
        );
      }
      data.supplier_id = fields.supplier_id ? fields.supplier_id.trim() : null;
    }
    if (typeof fields.is_active === "boolean")
      data.is_active = fields.is_active;
    if (fields.stock !== undefined) {
      if (
        fields.stock !== null &&
        (typeof fields.stock !== "number" ||
          !Number.isInteger(fields.stock) ||
          fields.stock < 0)
      ) {
        return NextResponse.json(
          { error: "stock must be a non-negative integer or null" },
          { status: 400 },
        );
      }
      data.stock = fields.stock;
    }
    if (fields.goal_qty !== undefined) {
      if (
        fields.goal_qty !== null &&
        (typeof fields.goal_qty !== "number" ||
          !Number.isInteger(fields.goal_qty) ||
          fields.goal_qty <= 0)
      ) {
        return NextResponse.json(
          { error: "goal_qty must be a positive integer or null" },
          { status: 400 },
        );
      }
      data.goal_qty = fields.goal_qty;
    }
    if (fields.image_url !== undefined) {
      if (
        fields.image_url !== null &&
        (typeof fields.image_url !== "string" || !fields.image_url.trim())
      ) {
        return NextResponse.json(
          { error: "image_url must be a non-empty string or null" },
          { status: 400 },
        );
      }
      data.image_url = fields.image_url ? fields.image_url.trim() : null;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "At least one field to update is required" },
        { status: 400 },
      );
    }

    const product = await update(
      id.trim(),
      data as Parameters<typeof update>[1],
    );
    return NextResponse.json({ product });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
