import { verifyToken, signToken } from "@/lib/auth/signed-token";
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

function getPublicOrderAccessSecret() {
  return (
    process.env.PUBLIC_ORDER_ACCESS_SECRET ||
    process.env.ADMIN_SESSION_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    ""
  );
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

export function createPublicOrderAccessToken(args: {
  orderNumber: string;
  purchaserName: string;
  phoneLast3: string;
}) {
  const secret = getPublicOrderAccessSecret();
  if (!secret) {
    throw new Error(
      "Missing PUBLIC_ORDER_ACCESS_SECRET, ADMIN_SESSION_SECRET, or SUPABASE_SERVICE_ROLE_KEY",
    );
  }

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
    secret,
  );
}

export function verifyPublicOrderAccessToken(
  token: string | null | undefined,
): PublicOrderAccessClaims | null {
  const secret = getPublicOrderAccessSecret();
  if (!secret) return null;

  const claims = verifyToken<PublicOrderAccessClaims>(token, secret);
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
