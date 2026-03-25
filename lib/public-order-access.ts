import { normalizePhoneDigits } from "@/lib/utils";

export type PublicOrderAccessSource = "lookup" | "checkout";

export interface PublicOrderAccessIdentity {
  purchaser_name: string;
  phone_last3: string;
}

export interface ResolvedPublicOrderAccess {
  identity: PublicOrderAccessIdentity;
  source: PublicOrderAccessSource | "legacy";
  consumeOnUse: boolean;
}

function normalizeIdentity(
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

export function serializePublicOrderAccess(
  identity: PublicOrderAccessIdentity,
  source: PublicOrderAccessSource,
): string {
  const normalized = normalizeIdentity(identity);
  if (!normalized) {
    throw new Error("Invalid public order access identity");
  }

  return JSON.stringify({
    ...normalized,
    source,
  });
}

export function parsePublicOrderAccess(
  raw: string | null | undefined,
): ResolvedPublicOrderAccess | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as
      | (Partial<PublicOrderAccessIdentity> & {
          source?: PublicOrderAccessSource;
        })
      | null;

    const identity = normalizeIdentity(parsed);
    if (!identity) return null;

    if (parsed?.source === "lookup") {
      return {
        identity,
        source: "lookup",
        consumeOnUse: false,
      };
    }

    if (parsed?.source === "checkout") {
      return {
        identity,
        source: "checkout",
        consumeOnUse: true,
      };
    }

    return {
      identity,
      source: "legacy",
      consumeOnUse: true,
    };
  } catch {
    return null;
  }
}
