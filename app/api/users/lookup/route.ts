import { NextRequest, NextResponse } from "next/server";
import { findByNickname } from "@/lib/db/users";

export async function GET(request: NextRequest) {
  try {
    const nickname = request.nextUrl.searchParams.get("nickname")?.trim();

    if (!nickname) {
      return NextResponse.json(
        { error: "nickname is required" },
        { status: 400 },
      );
    }

    const user = await findByNickname(nickname);
    return NextResponse.json({ user });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
