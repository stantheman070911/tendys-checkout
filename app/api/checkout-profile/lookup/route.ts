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
import { errorResponse, parseJsonBody, z } from "@/lib/validation";

const PHONE_RE = /^[\d\-+().\s]{7,20}$/;
const INCOMPLETE_PHONE_ERROR =
  "phone is required and must include a full phone number for autofill";
const checkoutProfileLookupSchema = z
  .object({
    nickname: z.string().optional(),
    phone: z.string().optional(),
  })
  .transform((value) => ({
    nickname: value.nickname?.trim() ?? "",
    phone: value.phone?.trim() ?? "",
  }))
  .superRefine((value, context) => {
    if (!value.nickname) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "nickname is required",
      });
    }

    const phoneDigits = normalizePhoneDigits(value.phone);
    if (
      !value.phone ||
      !PHONE_RE.test(value.phone) ||
      phoneDigits.length < PUBLIC_CHECKOUT_AUTOFILL_MIN_PHONE_DIGITS
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: INCOMPLETE_PHONE_ERROR,
      });
    }
  });

export async function POST(request: NextRequest) {
  try {
    const parsedBody = await parseJsonBody(request, checkoutProfileLookupSchema);
    if (!parsedBody.success) {
      return parsedBody.response;
    }

    const { nickname: trimmedNickname, phone: trimmedPhone } = parsedBody.data;

    const clientIp = getClientIp(request);
    const rateLimit = await checkRateLimit(
      `checkout-profile:${clientIp}`,
      5,
      60_000,
    );
    if (rateLimit.error === "backend_unavailable") {
      return errorResponse("Checkout profile lookup is temporarily unavailable", 503);
    }
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
