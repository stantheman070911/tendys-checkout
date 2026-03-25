import { NextRequest, NextResponse } from "next/server";
import { findPublicOrderByOrderNumberAndIdentity } from "@/lib/db/orders";
import {
  createPublicOrderAccessToken,
  getPublicOrderAccessCookieName,
  PUBLIC_ORDER_ACCESS_TTL_SECONDS,
  verifyPublicOrderAccessToken,
} from "@/lib/public-order-access";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { normalizePhoneDigits } from "@/lib/utils";

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};

function redirectToOrder(orderNumber: string, error?: string) {
  const pathname = orderNumber.trim()
    ? `/order/${encodeURIComponent(orderNumber)}`
    : "/lookup";
  const url = new URL(
    pathname,
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  );
  if (error) {
    url.searchParams.set("error", error);
  }
  return url;
}

function withAccessCookie(response: NextResponse, token: string) {
  const claims = verifyPublicOrderAccessToken(token);
  if (!claims) {
    return response;
  }

  response.cookies.set({
    ...COOKIE_OPTIONS,
    name: getPublicOrderAccessCookieName(claims.order_number),
    value: token,
    maxAge: PUBLIC_ORDER_ACCESS_TTL_SECONDS,
    path: `/order/${encodeURIComponent(claims.order_number)}`,
  });
  return response;
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const claims = verifyPublicOrderAccessToken(token);
  if (!claims) {
    const orderNumber = request.nextUrl.searchParams.get("order") ?? "";
    return NextResponse.redirect(
      redirectToOrder(orderNumber, "invalid"),
    );
  }

  const response = NextResponse.redirect(
    redirectToOrder(claims.order_number),
  );
  return withAccessCookie(response, token!);
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const orderNumber = String(formData.get("order_number") ?? "")
      .trim()
      .toUpperCase();
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(`public-order-access:${clientIp}`, 5, 60_000);
    if (!rateLimit.allowed) {
      return NextResponse.redirect(
        redirectToOrder(orderNumber, "rate_limited"),
      );
    }

    const purchaserName =
      String(formData.get("purchaser_name") ?? "").trim() ||
      String(formData.get("recipient_name") ?? "").trim();
    const phoneLast3 = normalizePhoneDigits(
      String(formData.get("phone_last3") ?? ""),
    );

    if (!orderNumber || !purchaserName || phoneLast3.length !== 3) {
      return NextResponse.redirect(redirectToOrder(orderNumber, "invalid"));
    }

    const order = await findPublicOrderByOrderNumberAndIdentity(
      orderNumber,
      purchaserName,
      phoneLast3,
    );
    if (!order) {
      return NextResponse.redirect(redirectToOrder(orderNumber, "not_found"));
    }

    const token = createPublicOrderAccessToken({
      orderNumber,
      purchaserName,
      phoneLast3,
    });
    const response = NextResponse.redirect(redirectToOrder(orderNumber));
    return withAccessCookie(response, token);
  } catch {
    return NextResponse.redirect(
      redirectToOrder("", "invalid"),
    );
  }
}
