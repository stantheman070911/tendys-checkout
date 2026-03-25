import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { verifyToken, signToken } from "@/lib/auth/signed-token";

export const ADMIN_SESSION_COOKIE_NAME = "tendy_admin_session";
export const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

export interface AdminSessionClaims {
  email: string;
  exp: number;
}

let adminClient: SupabaseClient | null = null;
let anonClient: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (adminClient) return adminClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase admin env vars");
  }
  adminClient = createClient(url, key);
  return adminClient;
}

export function getSupabaseAnon(): SupabaseClient {
  if (anonClient) return anonClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase anon env vars");
  }
  anonClient = createClient(url, key);
  return anonClient;
}

function getAdminSessionSecret() {
  return (
    process.env.ADMIN_SESSION_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    ""
  );
}

function isAllowedAdminEmail(email: string) {
  const allowedEmailsStr = process.env.ADMIN_EMAILS || "";
  const allowedEmails = allowedEmailsStr
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

  return allowedEmails.includes(email.toLowerCase());
}

function parseCookieHeader(header: string | null, name: string) {
  if (!header) return null;

  for (const part of header.split(/;\s*/)) {
    const [cookieName, ...rawValueParts] = part.split("=");
    if (cookieName !== name) continue;
    return decodeURIComponent(rawValueParts.join("="));
  }

  return null;
}

export function createAdminSessionValue(email: string) {
  const secret = getAdminSessionSecret();
  if (!secret) {
    throw new Error("Missing ADMIN_SESSION_SECRET or SUPABASE_SERVICE_ROLE_KEY");
  }

  return signToken(
    {
      email,
      exp: Math.floor(Date.now() / 1000) + ADMIN_SESSION_MAX_AGE_SECONDS,
    } satisfies AdminSessionClaims,
    secret,
  );
}

export function readAdminSessionValue(
  value: string | null | undefined,
): AdminSessionClaims | null {
  const secret = getAdminSessionSecret();
  if (!secret) return null;

  const claims = verifyToken<AdminSessionClaims>(value, secret);
  if (!claims?.email || typeof claims.exp !== "number") {
    return null;
  }

  if (claims.exp <= Math.floor(Date.now() / 1000)) {
    return null;
  }

  if (!isAllowedAdminEmail(claims.email)) {
    return null;
  }

  return claims;
}

export function getAdminSessionFromRequest(
  request: Request,
): AdminSessionClaims | null {
  return readAdminSessionValue(
    parseCookieHeader(
      request.headers.get("cookie"),
      ADMIN_SESSION_COOKIE_NAME,
    ),
  );
}

export async function verifyAdminAccessToken(
  token: string,
): Promise<AdminSessionClaims | null> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user || !data.user.email) return null;
    if (!isAllowedAdminEmail(data.user.email)) {
      return null;
    }

    return {
      email: data.user.email,
      exp: Math.floor(Date.now() / 1000) + ADMIN_SESSION_MAX_AGE_SECONDS,
    };
  } catch {
    return null;
  }
}

export async function verifyAdminSession(request: Request): Promise<boolean> {
  const cookieSession = getAdminSessionFromRequest(request);
  if (cookieSession) {
    return true;
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;

  const token = authHeader.slice(7);
  return !!(await verifyAdminAccessToken(token));
}
