import Link from "next/link";
import { ADMIN_BASE } from "@/constants";
import { ProductAggregationTable } from "@/components/admin/ProductAggregationTable";
import { AdminShell } from "@/components/admin/AdminShell";
import { getAdminDashboardSummary } from "@/lib/admin/dashboard";
import { getAdminChromeContext, requireAdminPageSession } from "@/lib/admin/server";
import { serializeForClient } from "@/lib/server-serialize";
import { formatCurrency } from "@/lib/utils";
import type { Round } from "@/types";

function buildRoundHref(path: string, roundId: string) {
  const params = new URLSearchParams({ roundId });
  return `${path}?${params.toString()}`;
}

export default async function DashboardPage({
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
      <AdminShell activeTab="dashboard" round={null} pendingCount={0}>
        <div className="text-center py-20 text-gray-400">
          目前沒有進行中的團購。請先到「開團」頁面新開一團。
        </div>
      </AdminShell>
    );
  }

  const summary = await getAdminDashboardSummary(round.id);
  const counts = summary.counts;
  const totalOrders = summary.totalOrders;
  const activeOrders = summary.activeOrders;
  const pendingConfirm = counts.pending_confirm ?? 0;
  const pendingPayment = counts.pending_payment ?? 0;
  const confirmed = counts.confirmed ?? 0;
  const shipped = counts.shipped ?? 0;

  const stats: Array<{
    label: string;
    value: string;
    href?: string;
  }> = [
    { label: "總訂單", value: `${totalOrders}` },
    { label: "總營收", value: formatCurrency(summary.totalRevenue) },
    {
      label: "待確認",
      value: `${pendingConfirm}`,
      href: buildRoundHref(`${ADMIN_BASE}/orders`, round.id) + "&status=pending_confirm",
    },
    {
      label: "待付款",
      value: `${pendingPayment}`,
      href: buildRoundHref(`${ADMIN_BASE}/orders`, round.id) + "&status=pending_payment",
    },
    {
      label: "待出貨",
      value: `${confirmed}`,
      href: buildRoundHref(`${ADMIN_BASE}/shipments`, round.id),
    },
    {
      label: "已出貨",
      value: `${shipped}`,
      href: buildRoundHref(`${ADMIN_BASE}/orders`, round.id) + "&status=shipped",
    },
  ];

  const clientRound = serializeForClient<Round>(round);

  return (
    <AdminShell
      activeTab="dashboard"
      round={clientRound}
      pendingCount={chrome.pendingCount}
    >
      <div className="space-y-5">
        <section className="lux-panel-strong p-5 md:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <div className="lux-kicker">Live Round Overview</div>
              <h1 className="font-display text-3xl text-[hsl(var(--ink))] md:text-4xl">
              {clientRound.name}
              </h1>
              <p className="text-sm leading-6 text-[hsl(var(--muted-foreground))]">
                掌握本輪訂單、營收、待確認付款與待出貨節奏。
                {clientRound.shipping_fee != null &&
                  ` 宅配運費目前為 ${formatCurrency(clientRound.shipping_fee)}。`}
              </p>
            </div>
            <div className="lux-panel-muted p-4 text-right">
              <div className="text-[11px] uppercase tracking-[0.22em] text-[hsl(var(--bronze))]">
                Active Orders
              </div>
              <div className="mt-2 font-display text-3xl text-[hsl(var(--ink))]">
                {activeOrders}
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {stats.map((stat) => {
            const content = (
              <>
                <div className="text-[11px] uppercase tracking-[0.2em] text-[hsl(var(--bronze))]">
                  {stat.label}
                </div>
                <div className="mt-3 font-display text-3xl text-[hsl(var(--ink))]">
                  {stat.value}
                </div>
                {stat.href && (
                  <div className="mt-2 text-xs font-medium text-[hsl(var(--muted-foreground))]">
                    查看明細
                  </div>
                )}
              </>
            );

            if (stat.href) {
              return (
                <Link
                  key={stat.label}
                  href={stat.href}
                  className="lux-panel lux-card-hover p-4"
                >
                  {content}
                </Link>
              );
            }

            return (
              <div key={stat.label} className="lux-panel p-4">
                {content}
              </div>
            );
          })}
        </div>

        <ProductAggregationTable
          rows={summary.productRows}
          roundId={clientRound.id}
        />

        {summary.notificationSummary.length > 0 && (
          <div className="lux-panel p-5">
            <div className="mb-3 font-display text-2xl text-[hsl(var(--ink))]">
              通知發送統計 (本團)
            </div>
            <div className="space-y-3">
              {summary.notificationSummary.map((entry) => (
                <div
                  key={entry.type}
                  className="border-b border-[rgba(177,140,92,0.14)] pb-3 last:border-0 last:pb-0"
                >
                  <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[hsl(var(--bronze))]">
                    {entry.type}
                  </div>
                  <div className="grid gap-2 text-xs sm:grid-cols-2">
                    <div className="lux-panel-muted flex items-center justify-between rounded-[1rem] p-3">
                      <span className="font-medium text-[hsl(var(--muted-foreground))]">
                        LINE
                      </span>
                      <span>
                        <span className="mr-2 font-medium text-[rgb(65,98,61)]">
                          ✓ {entry.line.success}
                        </span>
                        <span className="mr-2 font-medium text-[rgb(140,67,56)]">
                          ✗ {entry.line.failed}
                        </span>
                        <span className="font-medium text-[hsl(var(--muted-foreground))]">
                          — {entry.line.skipped}
                        </span>
                      </span>
                    </div>
                    <div className="lux-panel-muted flex items-center justify-between rounded-[1rem] p-3">
                      <span className="font-medium text-[hsl(var(--muted-foreground))]">
                        Email
                      </span>
                      <span>
                        <span className="mr-2 font-medium text-[rgb(65,98,61)]">
                          ✓ {entry.email.success}
                        </span>
                        <span className="mr-2 font-medium text-[rgb(140,67,56)]">
                          ✗ {entry.email.failed}
                        </span>
                        <span className="font-medium text-[hsl(var(--muted-foreground))]">
                          — {entry.email.skipped}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
