import { NextRequest, NextResponse } from "next/server";
import { findPublicOrderByOrderNumberAndIdentity } from "@/lib/db/orders";
import {
  buildPublicOrderPath,
  createPublicOrderAccessCookie,
  verifyPublicOrderAccessToken,
} from "@/lib/public-order-access";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import {
  getPublicOrderAccessSecret,
  isEnvironmentConfigurationError,
} from "@/lib/server-env";
import { normalizePhoneDigits } from "@/lib/utils";
import { parseFormData, parseSearchParams, z } from "@/lib/validation";

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};

function redirectToOrder(
  request: NextRequest,
  orderNumber: string,
  error?: string,
) {
  const pathname = orderNumber.trim()
    ? buildPublicOrderPath(orderNumber)
    : "/lookup";
  const url = request.nextUrl?.clone() ?? new URL(request.url);
  url.pathname = pathname;
  url.search = "";
  if (error) {
    url.searchParams.set("error", error);
  }
  return url;
}

function seeOther(url: URL) {
  return NextResponse.redirect(url, 303);
}

const publicOrderAccessFormSchema = z
  .object({
    order_number: z.string().optional(),
    purchaser_name: z.string().optional(),
    recipient_name: z.string().optional(),
    phone_last3: z.string().optional(),
  })
  .transform((value) => ({
    orderNumber: value.order_number?.trim().toUpperCase() ?? "",
    purchaserName:
      value.purchaser_name?.trim() || value.recipient_name?.trim() || "",
    phoneLast3: normalizePhoneDigits(value.phone_last3),
  }));

const publicOrderAccessTokenSchema = z.object({
  token: z.string().trim().min(1, { message: "token is required" }),
  order: z.string().trim().optional(),
});

export async function GET(request: NextRequest) {
  try {
    getPublicOrderAccessSecret();

    const parsedQuery = parseSearchParams(
      request.nextUrl.searchParams,
      publicOrderAccessTokenSchema,
    );
    if (!parsedQuery.success) {
      return seeOther(redirectToOrder(request, "", "invalid"));
    }

    const { token, order } = parsedQuery.data;
    const claims = verifyPublicOrderAccessToken(token);
    const requestedOrderNumber = order?.trim().toUpperCase() ?? "";

    if (!claims) {
      return seeOther(
        redirectToOrder(request, requestedOrderNumber, "invalid"),
      );
    }

    if (
      requestedOrderNumber &&
      claims.order_number !== requestedOrderNumber
    ) {
      return seeOther(
        redirectToOrder(request, requestedOrderNumber, "invalid"),
      );
    }

    const response = seeOther(
      redirectToOrder(request, claims.order_number),
    );
    response.cookies.set({
      ...COOKIE_OPTIONS,
      ...createPublicOrderAccessCookie({
        orderNumber: claims.order_number,
        purchaserName: claims.purchaser_name,
        phoneLast3: claims.phone_last3,
      }),
    });
    return response;
  } catch (error) {
    if (isEnvironmentConfigurationError(error)) {
      return seeOther(redirectToOrder(request, "", "service_unavailable"));
    }

    return seeOther(redirectToOrder(request, "", "invalid"));
  }
}

export async function POST(request: NextRequest) {
  try {
    getPublicOrderAccessSecret();

    const parsedForm = await parseFormData(request, publicOrderAccessFormSchema);
    if (!parsedForm.success) {
      return seeOther(redirectToOrder(request, "", "invalid"));
    }

    const { orderNumber, purchaserName, phoneLast3 } = parsedForm.data;
    const clientIp = getClientIp(request);
    const rateLimit = await checkRateLimit(
      `public-order-access:${clientIp}`,
      5,
      60_000,
    );
    if (rateLimit.error === "backend_unavailable") {
      return seeOther(
        redirectToOrder(request, orderNumber, "service_unavailable"),
      );
    }
    if (!rateLimit.allowed) {
      return seeOther(
        redirectToOrder(request, orderNumber, "rate_limited"),
      );
    }

    if (!orderNumber || !purchaserName || phoneLast3.length !== 3) {
      return seeOther(redirectToOrder(request, orderNumber, "invalid"));
    }

    const order = await findPublicOrderByOrderNumberAndIdentity(
      orderNumber,
      purchaserName,
      phoneLast3,
    );
    if (!order) {
      return seeOther(redirectToOrder(request, orderNumber, "not_found"));
    }

    const response = seeOther(redirectToOrder(request, orderNumber));
    response.cookies.set({
      ...COOKIE_OPTIONS,
      ...createPublicOrderAccessCookie({
        orderNumber,
        purchaserName,
        phoneLast3,
      }),
    });
    return response;
  } catch (error) {
    if (isEnvironmentConfigurationError(error)) {
      return seeOther(redirectToOrder(request, "", "service_unavailable"));
    }

    return seeOther(
      redirectToOrder(request, "", "invalid"),
    );
  }
}
