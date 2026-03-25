import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/auth/supabase-admin";
import { findAutofillProfileByNickname } from "@/lib/db/users";

export async function GET(request: NextRequest) {
  try {
    const isAdmin = await verifyAdminSession(request);
    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const nickname = request.nextUrl.searchParams.get("nickname")?.trim();

    if (!nickname) {
      return NextResponse.json(
        { error: "nickname is required" },
        { status: 400 },
      );
    }

    const user = await findAutofillProfileByNickname(nickname);

    // Return only auto-fill fields — strip id, timestamps, nickname
    const safeUser = user
      ? {
          purchaser_name: user.purchaser_name,
          recipient_name: user.recipient_name,
          phone: user.phone,
          address: user.address,
          email: user.email,
        }
      : null;

    return NextResponse.json({ user: safeUser });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
