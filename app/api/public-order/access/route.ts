import { NextRequest, NextResponse } from "next/server";
import { findPublicOrderByOrderNumberAndIdentity } from "@/lib/db/orders";
import {
  buildPublicOrderPath,
  createPublicOrderAccessCookie,
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
    ? buildPublicOrderPath(orderNumber)
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

function seeOther(url: URL) {
  return NextResponse.redirect(url, 303);
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
      return seeOther(
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
      return seeOther(redirectToOrder(orderNumber, "invalid"));
    }

    const order = await findPublicOrderByOrderNumberAndIdentity(
      orderNumber,
      purchaserName,
      phoneLast3,
    );
    if (!order) {
      return seeOther(redirectToOrder(orderNumber, "not_found"));
    }

    const response = seeOther(redirectToOrder(orderNumber));
    response.cookies.set({
      ...COOKIE_OPTIONS,
      ...createPublicOrderAccessCookie({
        orderNumber,
        purchaserName,
        phoneLast3,
      }),
    });
    return response;
  } catch {
    return seeOther(
      redirectToOrder("", "invalid"),
    );
  }
}
