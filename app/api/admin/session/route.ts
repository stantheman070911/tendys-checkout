import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE_NAME,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  createAdminSessionValue,
  getAdminSessionFromRequest,
  verifyAdminAccessToken,
} from "@/lib/auth/supabase-admin";
import { isEnvironmentConfigurationError } from "@/lib/server-env";

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

export async function GET(request: NextRequest) {
  try {
    const session = getAdminSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({ authorized: true, email: session.email });
  } catch (error) {
    if (isEnvironmentConfigurationError(error)) {
      return NextResponse.json(
        { error: "Admin session is temporarily unavailable" },
        { status: 503 },
      );
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

    const response = NextResponse.json({
      authorized: true,
      email: claims.email,
    });
    response.cookies.set({
      ...COOKIE_OPTIONS,
      name: ADMIN_SESSION_COOKIE_NAME,
      value: createAdminSessionValue(claims.email),
      maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
    });

    return response;
  } catch (error) {
    if (isEnvironmentConfigurationError(error)) {
      return NextResponse.json(
        { error: "Admin session is temporarily unavailable" },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  try {
    const response = NextResponse.json({ success: true });
    response.cookies.set({
      ...COOKIE_OPTIONS,
      name: ADMIN_SESSION_COOKIE_NAME,
      value: "",
      maxAge: 0,
    });
    return response;
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
