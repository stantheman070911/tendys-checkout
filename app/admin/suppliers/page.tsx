import { AdminShell } from "@/components/admin/AdminShell";
import { SuppliersPageClient } from "@/components/admin/SuppliersPageClient";
import { getAdminChromeContext, requireAdminPageSession } from "@/lib/admin/server";
import { listAllByRound } from "@/lib/db/products";
import { serializeForClient } from "@/lib/server-serialize";
import { list as listSuppliers } from "@/lib/db/suppliers";
import type { ProductWithProgress, Round, Supplier } from "@/types";

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{ roundId?: string }>;
}) {
  await requireAdminPageSession();

  const { roundId } = await searchParams;
  const chrome = await getAdminChromeContext(roundId);

  const [suppliers, products] = await Promise.all([
    listSuppliers(),
    chrome.round ? listAllByRound(chrome.round.id) : Promise.resolve([]),
  ]);

  return (
    <AdminShell
      activeTab="suppliers"
      round={chrome.round ? serializeForClient<Round>(chrome.round) : null}
      pendingCount={chrome.pendingCount}
    >
      <SuppliersPageClient
        round={chrome.round ? serializeForClient<Round>(chrome.round) : null}
        initialSuppliers={serializeForClient<
          Array<Supplier & { _count: { products: number } }>
        >(suppliers)}
        initialProducts={serializeForClient<ProductWithProgress[]>(products)}
      />
    </AdminShell>
  );
}
