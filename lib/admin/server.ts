import type { Round as DbRound } from "@prisma/client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_BASE } from "@/constants";
import { getPendingConfirmCount } from "@/lib/db/orders";
import { findById, getOpenRound, listRecent } from "@/lib/db/rounds";
import { ADMIN_SESSION_COOKIE_NAME, readAdminSessionValue } from "@/lib/auth/supabase-admin";
import {
  getPlaywrightAdminChromeFixture,
  isPlaywrightAdminFixtureEnabled,
} from "@/lib/testing/playwright-admin";

export interface AdminChromeContext {
  round: DbRound | null;
  rounds: DbRound[];
  pendingCount: number;
}

export async function requireAdminPageSession() {
  const cookieStore = await cookies();
  const session = readAdminSessionValue(
    cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value,
  );

  if (!session) {
    redirect(ADMIN_BASE);
  }

  return session;
}

export async function getAdminChromeContext(
  roundId?: string | null,
): Promise<AdminChromeContext> {
  if (isPlaywrightAdminFixtureEnabled()) {
    return getPlaywrightAdminChromeFixture();
  }

  const rounds = await listRecent(20);
  const openRound = rounds.find((entry) => entry.is_open) ?? (await getOpenRound());
  const selectedRound =
    roundId && roundId.trim()
      ? rounds.find((entry) => entry.id === roundId) ?? (await findById(roundId))
      : null;
  const round = selectedRound ?? openRound ?? null;
  const pendingCount = round ? await getPendingConfirmCount(round.id) : 0;

  return { round, rounds, pendingCount };
}
