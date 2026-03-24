import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/auth/supabase-admin";
import { list, create, update, deleteSupplier } from "@/lib/db/suppliers";

export async function GET(request: NextRequest) {
  try {
    const isAdmin = await verifyAdminSession(request);
    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const suppliers = await list();
    return NextResponse.json({ suppliers });
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

    const { name, contact_name, phone, email, note } = body as {
      name?: string;
      contact_name?: string;
      phone?: string;
      email?: string;
      note?: string;
    };

    const trimmedName = typeof name === "string" ? name.trim() : "";
    if (!trimmedName) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const supplier = await create({
      name: trimmedName,
      contact_name:
        typeof contact_name === "string"
          ? contact_name.trim() || undefined
          : undefined,
      phone: typeof phone === "string" ? phone.trim() || undefined : undefined,
      email: typeof email === "string" ? email.trim() || undefined : undefined,
      note: typeof note === "string" ? note.trim() || undefined : undefined,
    });

    return NextResponse.json({ supplier }, { status: 201 });
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
      contact_name?: string | null;
      phone?: string | null;
      email?: string | null;
      note?: string | null;
    };

    if (!id || typeof id !== "string" || !id.trim()) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const data: Record<string, string | null | undefined> = {};
    if (typeof fields.name === "string") {
      const trimmedName = fields.name.trim();
      if (!trimmedName) {
        return NextResponse.json(
          { error: "name cannot be blank" },
          { status: 400 },
        );
      }
      data.name = trimmedName;
    }
    if (fields.contact_name === null) data.contact_name = null;
    else if (typeof fields.contact_name === "string")
      data.contact_name = fields.contact_name.trim();
    if (fields.phone === null) data.phone = null;
    else if (typeof fields.phone === "string") data.phone = fields.phone.trim();
    if (fields.email === null) data.email = null;
    else if (typeof fields.email === "string") data.email = fields.email.trim();
    if (fields.note === null) data.note = null;
    else if (typeof fields.note === "string") data.note = fields.note.trim();

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "At least one field to update is required" },
        { status: 400 },
      );
    }

    const supplier = await update(id.trim(), data);
    return NextResponse.json({ supplier });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const isAdmin = await verifyAdminSession(request);
    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const id = request.nextUrl.searchParams.get("id");
    if (!id || !id.trim()) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const result = await deleteSupplier(id.trim());

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
