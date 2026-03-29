import { NextRequest, NextResponse } from "next/server";
import { handleEnvironmentConfigurationError } from "@/lib/api/errors";
import { verifyAdminSession } from "@/lib/auth/supabase-admin";
import { createCheckoutOrder } from "@/lib/db/orders";
import { getRequestId, getRouteFromRequest } from "@/lib/logger";
import {
  buildPublicOrderPath,
  createPublicOrderAccessCookie,
} from "@/lib/public-order-access";
import {
  getPublicOrderAccessSecret,
  isEnvironmentConfigurationError,
} from "@/lib/server-env";
import { getPhoneLast3 } from "@/lib/utils";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { parseJsonBody, uuidStringSchema, z } from "@/lib/validation";

const PHONE_RE = /^[\d\-+().\s]{7,20}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MAX_LEN = {
  nickname: 50,
  purchaser_name: 100,
  recipient_name: 100,
  phone: 20,
  address: 200,
  email: 254,
  note: 500,
} as const;

const PUBLIC_ORDER_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};

const requiredBoundedStringSchema = (field: keyof typeof MAX_LEN) =>
  z
    .unknown()
    .superRefine((value, context) => {
      if (typeof value !== "string" || !value.trim()) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${field} is required`,
        });
        return;
      }

      const trimmed = value.trim();
      if (trimmed.length > MAX_LEN[field]) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${field} must be ≤ ${MAX_LEN[field]} chars`,
        });
      }
    })
    .transform((value) => (typeof value === "string" ? value.trim() : ""));

const optionalBoundedStringSchema = (field: keyof typeof MAX_LEN) =>
  z
    .unknown()
    .superRefine((value, context) => {
      if (value === undefined || value === null || typeof value !== "string") {
        return;
      }

      const trimmed = value.trim();
      if (!trimmed) {
        return;
      }

      if (trimmed.length > MAX_LEN[field]) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${field} must be ≤ ${MAX_LEN[field]} chars`,
        });
      }
    })
    .transform((value) => {
      if (typeof value !== "string") {
        return undefined;
      }

      const trimmed = value.trim();
      return trimmed ? trimmed : undefined;
    });

const submissionKeySchema = uuidStringSchema("submission_key");

const roundIdSchema = uuidStringSchema("round_id");

const phoneSchema = z
  .unknown()
  .superRefine((value, context) => {
    if (typeof value !== "string" || !value.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "phone is required",
      });
      return;
    }

    const trimmed = value.trim();
    if (!PHONE_RE.test(trimmed)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "phone format is invalid",
      });
    }
  })
  .transform((value) => (typeof value === "string" ? value.trim() : ""));

const emailSchema = z
  .unknown()
  .superRefine((value, context) => {
    if (value === undefined || value === null || typeof value !== "string") {
      return;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }

    if (trimmed.length > MAX_LEN.email) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `email must be ≤ ${MAX_LEN.email} chars`,
      });
      return;
    }

    if (!EMAIL_RE.test(trimmed)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "email format is invalid",
      });
    }
  })
  .transform((value) => {
    if (typeof value !== "string") {
      return undefined;
    }

    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  });

const pickupLocationSchema = z
  .unknown()
  .superRefine((value, context) => {
    if (value === undefined || typeof value === "string") {
      return;
    }

    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "pickup_location must be a string",
    });
  })
  .transform((value) => (typeof value === "string" ? value.trim() : ""));

const orderItemSchema = z.object({
  product_id: uuidStringSchema("product_id"),
  quantity: z
    .unknown()
    .superRefine((value, context) => {
      if (
        typeof value !== "number" ||
        !Number.isInteger(value) ||
        value <= 0
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Each item must have a positive integer quantity",
        });
      }
    })
    .transform((value) => (typeof value === "number" ? value : 0)),
});

const itemsSchema = z
  .unknown()
  .superRefine((value, context) => {
    if (!Array.isArray(value) || value.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "items must be a non-empty array",
      });
    }
  })
  .transform((value) => (Array.isArray(value) ? value : []))
  .pipe(z.array(orderItemSchema))
  .superRefine((items, context) => {
    const seenProducts = new Set<string>();
    for (const item of items) {
      if (seenProducts.has(item.product_id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Duplicate products in order items",
        });
        return;
      }

      seenProducts.add(item.product_id);
    }
  });

const submitOrderSchema = z
  .object({
    round_id: roundIdSchema,
    nickname: requiredBoundedStringSchema("nickname"),
    purchaser_name: optionalBoundedStringSchema("purchaser_name"),
    recipient_name: requiredBoundedStringSchema("recipient_name"),
    phone: phoneSchema,
    address: optionalBoundedStringSchema("address"),
    email: emailSchema,
    pickup_location: pickupLocationSchema,
    items: itemsSchema,
    submission_key: submissionKeySchema,
    note: optionalBoundedStringSchema("note"),
    save_profile: z.unknown().transform((value) => value === true),
  })
  .superRefine((value, context) => {
    if (!value.purchaser_name && !value.recipient_name) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "purchaser_name is required",
      });
    }

    if (value.pickup_location === "" && !value.address) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "address is required for delivery",
      });
    }
  })
  .transform((value) => ({
    ...value,
    purchaser_name: value.purchaser_name ?? value.recipient_name,
  }));

export async function POST(request: NextRequest) {
  try {
    const isAdmin = await verifyAdminSession(request);
    if (!isAdmin) {
      const clientIp = getClientIp(request);
      const rateLimit = await checkRateLimit(
        `submit-order:${clientIp}`,
        5,
        60_000,
        {
          route: getRouteFromRequest(request),
          requestId: getRequestId(request),
        },
      );
      if (rateLimit.error === "backend_unavailable") {
        return NextResponse.json(
          { error: "Ordering is temporarily unavailable" },
          { status: 503 },
        );
      }
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

    const parsedBody = await parseJsonBody(request, submitOrderSchema);
    if (!parsedBody.success) {
      return parsedBody.response;
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
    } = parsedBody.data;

    getPublicOrderAccessSecret();

    // ─── Create order ───────────────────────────────────────

    const orderItems = items.map((item) => ({
      product_id: item.product_id,
      quantity: item.quantity,
    }));
    const shouldSaveProfile = save_profile;

    const result = await createCheckoutOrder({
      round_id,
      pickup_location,
      note,
      submission_key,
      items: orderItems,
      is_admin: isAdmin,
      save_profile: shouldSaveProfile,
      user: {
        nickname,
        purchaser_name,
        recipient_name,
        phone,
        address,
        email,
      },
    });

    switch (result.kind) {
      case "success": {
        const response = NextResponse.json(
          {
            order: result.order,
            detail_url: buildPublicOrderPath(result.order.order_number),
          },
          { status: result.deduplicated ? 200 : 201 },
        );

        response.cookies.set({
          ...PUBLIC_ORDER_COOKIE_OPTIONS,
          ...createPublicOrderAccessCookie({
            orderNumber: result.order.order_number,
            purchaserName: purchaser_name,
            phoneLast3: getPhoneLast3(phone),
          }),
        });

        return response;
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
    const response = handleEnvironmentConfigurationError(
      request,
      error,
      "Ordering is temporarily unavailable",
    );
    if (response) {
      return response;
    }

    console.error("POST /api/submit-order failed", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
