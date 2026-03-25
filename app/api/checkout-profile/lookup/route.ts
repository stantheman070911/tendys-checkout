import { NextRequest, NextResponse } from "next/server";
import {
  findSavedCheckoutProfileByNickname,
  phoneMatchesStoredProfile,
} from "@/lib/db/users";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import {
  normalizePhoneDigits,
  PUBLIC_CHECKOUT_AUTOFILL_MIN_PHONE_DIGITS,
} from "@/lib/utils";

const PHONE_RE = /^[\d\-+().\s]{7,20}$/;
const INCOMPLETE_PHONE_ERROR =
  "phone is required and must include a full phone number for autofill";

export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const { nickname, phone } = body as {
      nickname?: string;
      phone?: string;
    };

    const trimmedNickname = typeof nickname === "string" ? nickname.trim() : "";
    if (!trimmedNickname) {
      return NextResponse.json(
        { error: "nickname is required" },
        { status: 400 },
      );
    }

    const trimmedPhone = typeof phone === "string" ? phone.trim() : "";
    const phoneDigits = normalizePhoneDigits(trimmedPhone);
    if (
      !trimmedPhone ||
      !PHONE_RE.test(trimmedPhone) ||
      phoneDigits.length < PUBLIC_CHECKOUT_AUTOFILL_MIN_PHONE_DIGITS
    ) {
      return NextResponse.json(
        { error: INCOMPLETE_PHONE_ERROR },
        { status: 400 },
      );
    }

    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(`checkout-profile:${clientIp}`, 5, 60_000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        {
          status: 429,
          headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
        },
      );
    }

    const profile = await findSavedCheckoutProfileByNickname(trimmedNickname);
    if (!profile) {
      return NextResponse.json({ status: "not_found" as const });
    }

    if (!phoneMatchesStoredProfile(profile.phone, trimmedPhone)) {
      return NextResponse.json({ status: "phone_mismatch" as const });
    }

    return NextResponse.json({
      status: "matched" as const,
      profile: {
        nickname: profile.nickname,
        purchaser_name: profile.purchaser_name,
        recipient_name: profile.recipient_name,
        phone: profile.phone,
        address: profile.address,
        email: profile.email,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
