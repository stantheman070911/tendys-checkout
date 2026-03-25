import { AdminShell } from "@/components/admin/AdminShell";
import { ProductsPageClient } from "@/components/admin/ProductsPageClient";
import { getAdminChromeContext, requireAdminPageSession } from "@/lib/admin/server";
import { listAllByRound } from "@/lib/db/products";
import { serializeForClient } from "@/lib/server-serialize";
import { list as listSuppliers } from "@/lib/db/suppliers";
import type { ProductWithProgress, Round, Supplier } from "@/types";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ roundId?: string }>;
}) {
  await requireAdminPageSession();

  const { roundId } = await searchParams;
  const chrome = await getAdminChromeContext(roundId);
  const round = chrome.round;

  if (!round) {
    return (
      <AdminShell activeTab="products" round={null} pendingCount={0}>
        <div className="text-center py-20 text-gray-400">
          目前沒有進行中的團購。
        </div>
      </AdminShell>
    );
  }

  const [products, suppliers] = await Promise.all([
    listAllByRound(round.id),
    listSuppliers(),
  ]);
  const clientRound = serializeForClient<Round>(round);

  return (
    <AdminShell
      activeTab="products"
      round={clientRound}
      pendingCount={chrome.pendingCount}
    >
      <ProductsPageClient
        round={clientRound}
        initialProducts={serializeForClient<ProductWithProgress[]>(products)}
        suppliers={serializeForClient<Supplier[]>(suppliers)}
      />
    </AdminShell>
  );
}
