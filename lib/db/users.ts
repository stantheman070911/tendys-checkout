import { prisma } from "@/lib/db/prisma";
import { normalizePhoneDigits } from "@/lib/utils";

export function phoneMatchesStoredProfile(
  storedPhone: string | null | undefined,
  inputPhone: string | null | undefined,
) {
  const storedDigits = normalizePhoneDigits(storedPhone);
  const inputDigits = normalizePhoneDigits(inputPhone);
  return !!storedDigits && storedDigits === inputDigits;
}

export async function findSavedCheckoutProfileByNickname(nickname: string) {
  return prisma.savedCheckoutProfile.findUnique({
    where: { nickname },
  });
}

export async function findLatestUserSnapshotByNickname(nickname: string) {
  return prisma.user.findFirst({
    where: { nickname },
    orderBy: { created_at: "desc" },
  });
}

export async function findAutofillProfileByNickname(nickname: string) {
  const savedProfile = await findSavedCheckoutProfileByNickname(nickname);
  if (savedProfile) {
    return {
      nickname: savedProfile.nickname,
      purchaser_name: savedProfile.purchaser_name,
      recipient_name: savedProfile.recipient_name,
      phone: savedProfile.phone,
      address: savedProfile.address,
      email: savedProfile.email,
      source: "saved_profile" as const,
    };
  }

  const latestUser = await findLatestUserSnapshotByNickname(nickname);
  if (!latestUser) {
    return null;
  }

  return {
    nickname: latestUser.nickname,
    purchaser_name: latestUser.purchaser_name,
    recipient_name: latestUser.recipient_name,
    phone: latestUser.phone,
    address: latestUser.address,
    email: latestUser.email,
    source: "latest_snapshot" as const,
  };
}
