import { AdminShell } from "@/components/admin/AdminShell";
import { RoundsPageClient } from "@/components/admin/RoundsPageClient";
import { getAdminChromeContext, requireAdminPageSession } from "@/lib/admin/server";
import { listRecent } from "@/lib/db/rounds";
import { serializeForClient } from "@/lib/server-serialize";
import type { Round } from "@/types";

export default async function RoundsPage() {
  await requireAdminPageSession();

  const [chrome, rounds] = await Promise.all([
    getAdminChromeContext(),
    listRecent(20),
  ]);

  return (
    <AdminShell
      activeTab="rounds"
      round={chrome.round ? serializeForClient<Round>(chrome.round) : null}
      pendingCount={chrome.pendingCount}
    >
      <RoundsPageClient initialRounds={serializeForClient<Round[]>(rounds)} />
    </AdminShell>
  );
}
