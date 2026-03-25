import { AdminShell } from "@/components/admin/AdminShell";
import { OrdersPageClient } from "@/components/admin/OrdersPageClient";
import { getAdminChromeContext, requireAdminPageSession } from "@/lib/admin/server";
import { listPageByRound } from "@/lib/db/orders";
import { listAllByRound } from "@/lib/db/products";
import { serializeForClient } from "@/lib/server-serialize";
import { ORDER_STATUS } from "@/constants";
import type { AdminOrderListRow, ProductWithProgress, Round } from "@/types";

const VALID_STATUSES = new Set([
  "all",
  ...Object.values(ORDER_STATUS),
]);

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{
    roundId?: string;
    page?: string;
    q?: string;
    status?: string;
    showPOS?: string;
  }>;
}) {
  await requireAdminPageSession();

  const params = await searchParams;
  const chrome = await getAdminChromeContext(params.roundId);
  const round = chrome.round;

  if (!round) {
    return (
      <AdminShell activeTab="orders" round={null} pendingCount={0}>
        <div className="text-center py-20 text-gray-400">
          目前沒有進行中的團購。
        </div>
      </AdminShell>
    );
  }

  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const status =
    params.status && VALID_STATUSES.has(params.status)
      ? params.status
      : "all";
  const search = params.q?.trim() ?? "";

  const [ordersPage, products] = await Promise.all([
    listPageByRound({
      roundId: round.id,
      status: status === "all" ? undefined : status,
      search,
      page,
      pageSize: 50,
    }),
    listAllByRound(round.id),
  ]);
  const clientRound = serializeForClient<Round>(round);

  return (
    <AdminShell
      activeTab="orders"
      round={clientRound}
      pendingCount={chrome.pendingCount}
    >
      <OrdersPageClient
        round={clientRound}
        initialOrders={serializeForClient<AdminOrderListRow[]>(ordersPage.items)}
        total={ordersPage.total}
        page={ordersPage.page}
        pageSize={ordersPage.pageSize}
        hasMore={ordersPage.hasMore}
        initialStatus={status}
        initialSearch={search}
        initialShowPos={params.showPOS === "1"}
        products={serializeForClient<ProductWithProgress[]>(products)}
      />
    </AdminShell>
  );
}
