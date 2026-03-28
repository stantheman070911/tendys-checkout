import { verifyToken, signToken } from "@/lib/auth/signed-token";
import { getPublicOrderAccessSecret } from "@/lib/server-env";
import { normalizePhoneDigits } from "@/lib/utils";

export const PUBLIC_ORDER_ACCESS_TTL_SECONDS = 60 * 60 * 24;

export interface PublicOrderAccessIdentity {
  purchaser_name: string;
  phone_last3: string;
}

export interface PublicOrderAccessClaims {
  order_number: string;
  purchaser_name: string;
  phone_last3: string;
  exp: number;
}

export function normalizePublicOrderAccessIdentity(
  value: Partial<PublicOrderAccessIdentity> | null | undefined,
): PublicOrderAccessIdentity | null {
  const purchaserName =
    value?.purchaser_name?.trim() ??
    (value as { recipient_name?: string | null } | null | undefined)
      ?.recipient_name?.trim() ??
    "";
  const phoneLast3 = normalizePhoneDigits(value?.phone_last3).trim();

  if (!purchaserName || phoneLast3.length !== 3) {
    return null;
  }

  return {
    purchaser_name: purchaserName,
    phone_last3: phoneLast3,
  };
}

export function getPublicOrderAccessCookieName(orderNumber: string) {
  return `tendy_order_access_${Buffer.from(
    orderNumber.trim().toUpperCase(),
    "utf8",
  ).toString("base64url")}`;
}

export function buildPublicOrderPath(orderNumber: string) {
  return `/order/${encodeURIComponent(orderNumber.trim().toUpperCase())}`;
}

export function buildPublicOrderAccessPath(args: {
  token: string;
  orderNumber?: string;
}) {
  const params = new URLSearchParams({ token: args.token });
  if (args.orderNumber) {
    params.set("order", args.orderNumber.trim().toUpperCase());
  }
  return `/api/public-order/access?${params.toString()}`;
}

export function createPublicOrderAccessToken(args: {
  orderNumber: string;
  purchaserName: string;
  phoneLast3: string;
}) {
  const identity = normalizePublicOrderAccessIdentity({
    purchaser_name: args.purchaserName,
    phone_last3: args.phoneLast3,
  });
  if (!identity) {
    throw new Error("Invalid public order access identity");
  }

  return signToken(
    {
      order_number: args.orderNumber.trim().toUpperCase(),
      purchaser_name: identity.purchaser_name,
      phone_last3: identity.phone_last3,
      exp: Math.floor(Date.now() / 1000) + PUBLIC_ORDER_ACCESS_TTL_SECONDS,
    } satisfies PublicOrderAccessClaims,
    getPublicOrderAccessSecret(),
  );
}

export function verifyPublicOrderAccessToken(
  token: string | null | undefined,
): PublicOrderAccessClaims | null {
  if (!token) {
    return null;
  }

  const claims = verifyToken<PublicOrderAccessClaims>(
    token,
    getPublicOrderAccessSecret(),
  );
  if (
    !claims?.order_number ||
    !claims.purchaser_name ||
    typeof claims.exp !== "number"
  ) {
    return null;
  }

  if (claims.exp <= Math.floor(Date.now() / 1000)) {
    return null;
  }

  const identity = normalizePublicOrderAccessIdentity(claims);
  if (!identity) {
    return null;
  }

  return {
    order_number: claims.order_number.trim().toUpperCase(),
    purchaser_name: identity.purchaser_name,
    phone_last3: identity.phone_last3,
    exp: claims.exp,
  };
}

export function createPublicOrderAccessCookie(args: {
  orderNumber: string;
  purchaserName: string;
  phoneLast3: string;
}) {
  const orderNumber = args.orderNumber.trim().toUpperCase();

  return {
    name: getPublicOrderAccessCookieName(orderNumber),
    value: createPublicOrderAccessToken(args),
    maxAge: PUBLIC_ORDER_ACCESS_TTL_SECONDS,
    path: buildPublicOrderPath(orderNumber),
  };
}

export function createPublicOrderAccessDetailUrl(args: {
  orderNumber: string;
  purchaserName: string;
  phoneLast3: string;
}) {
  return buildPublicOrderAccessPath({
    token: createPublicOrderAccessToken(args),
    orderNumber: args.orderNumber,
  });
}
