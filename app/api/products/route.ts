import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/auth/supabase-admin";
import {
  listActiveByRound,
  listAllByRound,
  create,
  update,
} from "@/lib/db/products";
import {
  nonNegativeIntegerOrNullSchema,
  parseJsonBody,
  parseSearchParams,
  requiredTrimmedStringSchema,
  uuidStringSchema,
  z,
} from "@/lib/validation";

const PUBLIC_CACHE_CONTROL = "public, s-maxage=30, stale-while-revalidate=60";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const nullableSupplierIdSchema = (preserveUndefined: boolean) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .superRefine((value, context) => {
      if (value === undefined || value === null) {
        return;
      }

      const trimmed = value.trim();
      if (!trimmed) {
        return;
      }

      if (!UUID_RE.test(trimmed)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "supplier_id must be a valid UUID or null",
        });
      }
    })
    .transform((value) => {
      if (value === undefined) {
        return preserveUndefined ? undefined : null;
      }
      if (value === null) {
        return null;
      }

      const trimmed = value.trim();
      return trimmed ? trimmed : null;
    });

const productsQuerySchema = z.object({
  roundId: uuidStringSchema("roundId"),
  all: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
});

const productCreateSchema = z.object({
  name: requiredTrimmedStringSchema("name"),
  price: z
    .number({ message: "price must be a positive integer" })
    .int("price must be a positive integer")
    .positive("price must be a positive integer"),
  unit: requiredTrimmedStringSchema("unit"),
  round_id: uuidStringSchema("round_id"),
  supplier_id: nullableSupplierIdSchema(false),
  stock: nonNegativeIntegerOrNullSchema("stock"),
  goal_qty: z
    .union([
      z.null(),
      z
        .number({ message: "goal_qty must be a positive integer or null" })
        .int("goal_qty must be a positive integer or null")
        .positive("goal_qty must be a positive integer or null"),
      z.undefined(),
    ])
    .transform((value) => (value === undefined ? undefined : value)),
  image_url: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => {
      if (typeof value !== "string") return null;
      const trimmed = value.trim();
      return trimmed ? trimmed : null;
    }),
});

const productUpdateSchema = z.object({
  id: uuidStringSchema("id"),
  name: z
    .string()
    .transform((value) => value.trim())
    .pipe(z.string().min(1, { message: "name cannot be empty" }))
    .optional(),
  price: z
    .number({ message: "price must be a positive integer" })
    .int("price must be a positive integer")
    .positive("price must be a positive integer")
    .optional(),
  unit: z
    .string()
    .transform((value) => value.trim())
    .pipe(z.string().min(1, { message: "unit cannot be empty" }))
    .optional(),
  round_id: z
    .string()
    .trim()
    .uuid({ message: "round_id must be a valid UUID" })
    .optional(),
  supplier_id: nullableSupplierIdSchema(true),
  is_active: z.boolean().optional(),
  stock: nonNegativeIntegerOrNullSchema("stock"),
  goal_qty: z
    .union([
      z.null(),
      z
        .number({ message: "goal_qty must be a positive integer or null" })
        .int("goal_qty must be a positive integer or null")
        .positive("goal_qty must be a positive integer or null"),
      z.undefined(),
    ])
    .transform((value) => (value === undefined ? undefined : value)),
  image_url: z
    .union([z.string(), z.null(), z.undefined()])
    .superRefine((value, context) => {
      if (value === undefined || value === null || value.trim()) {
        return;
      }

      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "image_url must be a non-empty string or null",
      });
    })
    .transform((value) => {
      if (value === undefined) return undefined;
      if (value === null) return null;
      const trimmed = value.trim();
      return trimmed ? trimmed : null;
    }),
});

// Public — storefront needs product list. Admin with ?all=true gets inactive products too.
export async function GET(request: NextRequest) {
  try {
    const parsedQuery = parseSearchParams(
      request.nextUrl.searchParams,
      productsQuerySchema,
    );
    if (!parsedQuery.success) {
      return parsedQuery.response;
    }

    const { roundId, all } = parsedQuery.data;
    if (all) {
      const isAdmin = await verifyAdminSession(request);
      if (!isAdmin) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const products = await listAllByRound(roundId);
      return NextResponse.json({ products });
    }

    const products = await listActiveByRound(roundId);
    return NextResponse.json(
      { products },
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

    const parsedBody = await parseJsonBody(request, productCreateSchema);
    if (!parsedBody.success) {
      return parsedBody.response;
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
    } = parsedBody.data;

    const product = await create({
      name,
      price,
      unit,
      round_id,
      supplier_id,
      stock: stock ?? null,
      goal_qty: goal_qty ?? null,
      image_url,
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

    const parsedBody = await parseJsonBody(request, productUpdateSchema);
    if (!parsedBody.success) {
      return parsedBody.response;
    }

    const { id, ...fields } = parsedBody.data;

    // Build update data, validating each field if present
    const data: Record<string, unknown> = {};

    if (typeof fields.name === "string") {
      data.name = fields.name;
    }
    if (typeof fields.price === "number") {
      data.price = fields.price;
    }
    if (typeof fields.unit === "string") {
      data.unit = fields.unit;
    }
    if (typeof fields.round_id === "string")
      data.round_id = fields.round_id;
    if (fields.supplier_id !== undefined) {
      data.supplier_id = fields.supplier_id;
    }
    if (typeof fields.is_active === "boolean")
      data.is_active = fields.is_active;
    if (fields.stock !== undefined) {
      data.stock = fields.stock;
    }
    if (fields.goal_qty !== undefined) {
      data.goal_qty = fields.goal_qty;
    }
    if (fields.image_url !== undefined) {
      data.image_url = fields.image_url;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "At least one field to update is required" },
        { status: 400 },
      );
    }

    const product = await update(
      id,
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
