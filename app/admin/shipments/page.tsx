import { AdminShell } from "@/components/admin/AdminShell";
import { ShipmentsPageClient } from "@/components/admin/ShipmentsPageClient";
import { getAdminChromeContext, requireAdminPageSession } from "@/lib/admin/server";
import { listPageByRound } from "@/lib/db/orders";
import { serializeForClient } from "@/lib/server-serialize";
import type { OrderWithItems, Round } from "@/types";

export default async function ShipmentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    roundId?: string;
    page?: string;
    q?: string;
    productId?: string;
    productName?: string;
  }>;
}) {
  await requireAdminPageSession();

  const params = await searchParams;
  const chrome = await getAdminChromeContext(params.roundId);
  const round = chrome.round;

  if (!round) {
    return (
      <AdminShell activeTab="shipments" round={null} pendingCount={0}>
        <div className="text-center py-20 text-gray-400">
          目前沒有進行中的團購。
        </div>
      </AdminShell>
    );
  }

  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const search = params.q?.trim() ?? "";
  const productId = params.productId?.trim() ?? "";

  const ordersPage = await listPageByRound({
    roundId: round.id,
    status: "confirmed",
    search,
    productId: productId || undefined,
    page,
    pageSize: 50,
  });
  const clientRound = serializeForClient<Round>(round);

  return (
    <AdminShell
      activeTab="shipments"
      round={clientRound}
      pendingCount={chrome.pendingCount}
    >
      <ShipmentsPageClient
        round={clientRound}
        initialOrders={serializeForClient<OrderWithItems[]>(ordersPage.items)}
        total={ordersPage.total}
        page={ordersPage.page}
        pageSize={ordersPage.pageSize}
        hasMore={ordersPage.hasMore}
        initialSearch={search}
        productFilterId={productId}
        productFilterName={params.productName?.trim() ?? ""}
      />
    </AdminShell>
  );
}
