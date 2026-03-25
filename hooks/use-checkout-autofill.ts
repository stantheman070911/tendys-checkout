"use client";

import { useEffect, useEffectEvent, useState } from "react";
import {
  normalizePhoneDigits,
  PUBLIC_CHECKOUT_AUTOFILL_MIN_PHONE_DIGITS,
} from "@/lib/utils";

type AutofillProfile = {
  purchaser_name?: string | null;
  recipient_name?: string | null;
  address?: string | null;
  email?: string | null;
};

type AutofillResponse = {
  status: "matched" | "not_found" | "phone_mismatch";
  profile?: AutofillProfile;
};

export type CheckoutAutofillStatus =
  | "idle"
  | "loading"
  | "matched"
  | "phone_mismatch"
  | "not_found";

export function useCheckoutAutofill(args: {
  nickname: string;
  phone: string;
  onMatchedProfile: (profile: AutofillProfile) => void;
}) {
  const { nickname, phone, onMatchedProfile } = args;
  const [autofillStatus, setAutofillStatus] =
    useState<CheckoutAutofillStatus>("idle");
  const applyMatchedProfile = useEffectEvent(onMatchedProfile);
  const nicknameTrimmed = nickname.trim();
  const phoneDigits = normalizePhoneDigits(phone);
  const canAutofill =
    !!nicknameTrimmed &&
    phoneDigits.length >= PUBLIC_CHECKOUT_AUTOFILL_MIN_PHONE_DIGITS;
  const visibleAutofillStatus = canAutofill ? autofillStatus : "idle";

  useEffect(() => {
    if (!canAutofill) {
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setAutofillStatus("loading");
      try {
        const res = await fetch("/api/checkout-profile/lookup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nickname: nicknameTrimmed,
            phone: phone.trim(),
          }),
        });

        if (!res.ok) {
          if (!cancelled) {
            setAutofillStatus("idle");
          }
          return;
        }

        const data = (await res.json()) as AutofillResponse;
        if (cancelled) {
          return;
        }

        if (data.status === "matched" && data.profile) {
          applyMatchedProfile(data.profile);
          setAutofillStatus("matched");
          return;
        }

        setAutofillStatus(data.status);
      } catch {
        if (!cancelled) {
          setAutofillStatus("idle");
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [canAutofill, nicknameTrimmed, phone]);

  function resetAutofillStatus() {
    setAutofillStatus("idle");
  }

  return {
    autofillStatus,
    visibleAutofillStatus,
    resetAutofillStatus,
  };
}
