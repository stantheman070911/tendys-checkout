import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { AuthMode } from "@/lib/logger";
import { verifyToken, signToken } from "@/lib/auth/signed-token";
import { getKeyValueStore } from "@/lib/upstash";
import {
  allowBearerAdminSessionFallback,
  getAdminSessionSecret,
} from "@/lib/server-env";

export const ADMIN_SESSION_COOKIE_NAME = "tendy_admin_session";
export const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 4;

export interface AdminSessionClaims extends Record<string, unknown> {
  email: string;
  sid: string;
  exp: number;
}

export interface AdminAuthorizationResult {
  authorized: boolean;
  mode: AuthMode;
  claims: AdminSessionClaims | null;
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

let cachedAllowedEmails: Set<string> | null = null;

function isAllowedAdminEmail(email: string) {
  if (!cachedAllowedEmails) {
    const allowedEmailsStr = process.env.ADMIN_EMAILS || "";
    cachedAllowedEmails = new Set(
      allowedEmailsStr
        .split(",")
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean),
    );
  }
  return cachedAllowedEmails.has(email.toLowerCase());
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
  return createAdminSessionValueWithSid(email, crypto.randomUUID());
}

function buildAdminSessionClaims(email: string, sid: string): AdminSessionClaims {
  return {
    email,
    sid,
    exp: Math.floor(Date.now() / 1000) + ADMIN_SESSION_MAX_AGE_SECONDS,
  };
}

function buildAdminSessionStoreKey(sessionId: string) {
  return `admin-session:${sessionId}`;
}

export function createAdminSessionValueWithSid(email: string, sid: string) {
  return signToken(
    buildAdminSessionClaims(email, sid),
    getAdminSessionSecret(),
  );
}

function parseSignedAdminSessionValue(
  value: string | null | undefined,
): AdminSessionClaims | null {
  if (!value) {
    return null;
  }

  const claims = verifyToken<AdminSessionClaims>(value, getAdminSessionSecret());
  if (!claims?.email || !claims.sid || typeof claims.exp !== "number") {
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

export async function createAdminSession(email: string) {
  const sid = crypto.randomUUID();
  const claims = buildAdminSessionClaims(email, sid);

  await getKeyValueStore().set(
    buildAdminSessionStoreKey(sid),
    { email },
    { ex: ADMIN_SESSION_MAX_AGE_SECONDS },
  );

  return {
    claims,
    value: createAdminSessionValueWithSid(email, sid),
  };
}

export async function revokeAdminSession(sessionId: string) {
  await getKeyValueStore().del(buildAdminSessionStoreKey(sessionId));
}

export async function readAdminSessionValue(
  value: string | null | undefined,
): Promise<AdminSessionClaims | null> {
  const claims = parseSignedAdminSessionValue(value);
  if (!claims) {
    return null;
  }

  const stored = await getKeyValueStore().get<{ email?: string }>(
    buildAdminSessionStoreKey(claims.sid),
  );

  if (!stored?.email && process.env.PLAYWRIGHT_ADMIN_FIXTURE === "1") {
    return claims;
  }

  if (!stored?.email || stored.email.toLowerCase() !== claims.email.toLowerCase()) {
    return null;
  }

  return claims;
}

export async function getAdminSessionFromRequest(
  request: Request,
): Promise<AdminSessionClaims | null> {
  return readAdminSessionValue(
    parseCookieHeader(
      request.headers.get("cookie"),
      ADMIN_SESSION_COOKIE_NAME,
    ),
  );
}

export async function verifyAdminAccessToken(
  token: string,
): Promise<{ email: string } | null> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user || !data.user.email) return null;
    if (!isAllowedAdminEmail(data.user.email)) {
      return null;
    }

    return {
      email: data.user.email,
    };
  } catch {
    return null;
  }
}

export async function authorizeAdminRequest(
  request: Request,
): Promise<AdminAuthorizationResult> {
  const cookieSession = getAdminSessionFromRequest(request);
  if (await cookieSession) {
    return {
      authorized: true,
      mode: "cookie",
      claims: await cookieSession,
    };
  }

  if (!allowBearerAdminSessionFallback()) {
    return {
      authorized: false,
      mode: "none",
      claims: null,
    };
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return {
      authorized: false,
      mode: "none",
      claims: null,
    };
  }

  const token = authHeader.slice(7);
  const claims = await verifyAdminAccessToken(token);
  if (!claims) {
    return {
      authorized: false,
      mode: "none",
      claims: null,
    };
  }

  return {
    authorized: true,
    mode: "bearer",
    claims: buildAdminSessionClaims(claims.email, "bearer"),
  };
}

export async function verifyAdminSession(request: Request): Promise<boolean> {
  return (await authorizeAdminRequest(request)).authorized;
}
