import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/auth/supabase-admin";
import { list, create, update, deleteSupplier } from "@/lib/db/suppliers";
import {
  optionalNullableTrimmedStringSchema,
  optionalTrimmedStringSchema,
  parseJsonBody,
  parseSearchParams,
  requiredTrimmedStringSchema,
  uuidStringSchema,
  z,
} from "@/lib/validation";

const supplierCreateSchema = z.object({
  name: requiredTrimmedStringSchema("name"),
  contact_name: optionalTrimmedStringSchema(),
  phone: optionalTrimmedStringSchema(),
  email: optionalTrimmedStringSchema(),
  note: optionalTrimmedStringSchema(),
});

const supplierUpdateSchema = z.object({
  id: uuidStringSchema("id"),
  name: z
    .string()
    .transform((value) => value.trim())
    .pipe(z.string().min(1, { message: "name cannot be blank" }))
    .optional(),
  contact_name: optionalNullableTrimmedStringSchema(),
  phone: optionalNullableTrimmedStringSchema(),
  email: optionalNullableTrimmedStringSchema(),
  note: optionalNullableTrimmedStringSchema(),
});

const supplierDeleteQuerySchema = z.object({
  id: uuidStringSchema("id"),
});

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

    const parsedBody = await parseJsonBody(request, supplierCreateSchema);
    if (!parsedBody.success) {
      return parsedBody.response;
    }

    const { name, contact_name, phone, email, note } = parsedBody.data;

    const supplier = await create({
      name,
      contact_name,
      phone,
      email,
      note,
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

    const parsedBody = await parseJsonBody(request, supplierUpdateSchema);
    if (!parsedBody.success) {
      return parsedBody.response;
    }

    const { id, ...fields } = parsedBody.data;

    const data: Record<string, string | null | undefined> = {};
    if (typeof fields.name === "string") data.name = fields.name;
    if (fields.contact_name !== undefined) data.contact_name = fields.contact_name;
    if (fields.phone !== undefined) data.phone = fields.phone;
    if (fields.email !== undefined) data.email = fields.email;
    if (fields.note !== undefined) data.note = fields.note;

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "At least one field to update is required" },
        { status: 400 },
      );
    }

    const supplier = await update(id, data);
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

    const parsedQuery = parseSearchParams(
      request.nextUrl.searchParams,
      supplierDeleteQuerySchema,
    );
    if (!parsedQuery.success) {
      return parsedQuery.response;
    }

    const result = await deleteSupplier(parsedQuery.data.id);

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
