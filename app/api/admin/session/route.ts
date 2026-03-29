import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE_NAME,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  createAdminSession,
  getAdminSessionFromRequest,
  revokeAdminSession,
  verifyAdminAccessToken,
} from "@/lib/auth/supabase-admin";
import { handleEnvironmentConfigurationError } from "@/lib/api/errors";
import { getRequestId, getRouteFromRequest, logError } from "@/lib/logger";

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({ authorized: true, email: session.email });
  } catch (error) {
    const response = handleEnvironmentConfigurationError(
      request,
      error,
      "Admin session is temporarily unavailable",
    );
    if (response) {
      return response;
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Authorization header is required" },
        { status: 400 },
      );
    }

    const accessToken = authHeader.slice(7);
    const claims = await verifyAdminAccessToken(accessToken);
    if (!claims) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const session = await createAdminSession(claims.email);

    const response = NextResponse.json({
      authorized: true,
      email: session.claims.email,
    });
    response.cookies.set({
      ...COOKIE_OPTIONS,
      name: ADMIN_SESSION_COOKIE_NAME,
      value: session.value,
      maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
    });

    return response;
  } catch (error) {
    const response = handleEnvironmentConfigurationError(
      request,
      error,
      "Admin session is temporarily unavailable",
    );
    if (response) {
      return response;
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getAdminSessionFromRequest(request);
    if (session) {
      await revokeAdminSession(session.sid);
    }

    const response = NextResponse.json({ success: true });
    response.cookies.set({
      ...COOKIE_OPTIONS,
      name: ADMIN_SESSION_COOKIE_NAME,
      value: "",
      maxAge: 0,
    });
    return response;
  } catch (error) {
    logError({
      event: "admin_session_delete_failed",
      requestId: getRequestId(request),
      route: getRouteFromRequest(request),
      error,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
