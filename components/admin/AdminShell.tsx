import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import {
  ClipboardList,
  Factory,
  LayoutDashboard,
  PackageCheck,
  RefreshCw,
  Tag,
} from "lucide-react";
import { ADMIN_BASE } from "@/constants";
import { AdminLogoutButton } from "@/components/admin/AdminLogoutButton";
import type { Round } from "@/types";

type AdminTabKey =
  | "dashboard"
  | "orders"
  | "shipments"
  | "products"
  | "rounds"
  | "suppliers";

const TABS: Array<{
  key: AdminTabKey;
  label: string;
  icon: ComponentType<{ className?: string }>;
}> = [
  { key: "dashboard", label: "儀表板", icon: LayoutDashboard },
  { key: "orders", label: "訂單", icon: ClipboardList },
  { key: "shipments", label: "出貨", icon: PackageCheck },
  { key: "products", label: "商品", icon: Tag },
  { key: "rounds", label: "開團", icon: RefreshCw },
  { key: "suppliers", label: "供應商", icon: Factory },
];

function getTabHref(tabKey: AdminTabKey, roundId: string | null) {
  const basePath =
    tabKey === "dashboard"
      ? `${ADMIN_BASE}/dashboard`
      : `${ADMIN_BASE}/${tabKey}`;

  if (!roundId || tabKey === "rounds") {
    return basePath;
  }

  const params = new URLSearchParams({ roundId });
  return `${basePath}?${params.toString()}`;
}

export function AdminShell({
  children,
  activeTab,
  round,
  pendingCount,
}: {
  children: ReactNode;
  activeTab: AdminTabKey;
  round: Round | null;
  pendingCount: number;
}) {
  const posHref = (() => {
    const params = new URLSearchParams();
    if (round?.id) {
      params.set("roundId", round.id);
    }
    params.set("showPOS", "1");
    return `${ADMIN_BASE}/orders?${params.toString()}`;
  })();

  return (
    <div className="lux-shell">
      <header className="sticky top-0 z-30 border-b border-[rgba(177,140,92,0.18)] bg-[rgba(246,241,233,0.78)] backdrop-blur-xl">
        <div className="lux-page space-y-4 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <div className="lux-kicker">Tendy Admin Atelier</div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-display text-2xl text-[hsl(var(--ink))] md:text-3xl">
                  後台作業台
                </span>
                {round && <span className="lux-pill">開團中 · {round.name}</span>}
              </div>
            </div>

            <div className="lux-action-row">
              <Link
                href={posHref}
                className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-[hsl(var(--forest))] px-5 py-2.5 text-sm font-semibold text-[hsl(var(--mist))]"
              >
                新增代客訂單
              </Link>
              <AdminLogoutButton />
            </div>
          </div>

          <div className="lux-panel flex gap-2 overflow-x-auto p-2">
            {TABS.map(({ key, icon: Icon, label }) => {
              const isActive = activeTab === key;
              return (
                <Link
                  key={key}
                  href={getTabHref(key, round?.id ?? null)}
                  className={`inline-flex min-h-[46px] items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium whitespace-nowrap transition ${
                    isActive
                      ? "bg-[hsl(var(--forest))] text-[hsl(var(--mist))] shadow-[0_18px_36px_-28px_rgba(22,31,26,0.75)]"
                      : "text-[hsl(var(--muted-foreground))] hover:bg-[rgba(236,224,205,0.4)] hover:text-[hsl(var(--ink))]"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                  {key === "orders" && pendingCount > 0 && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        isActive
                          ? "bg-white/16 text-white"
                          : "bg-[rgba(189,111,98,0.16)] text-[rgb(140,67,56)]"
                      }`}
                    >
                      {pendingCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </header>

      <div className="lux-page pb-32">{children}</div>
    </div>
  );
}
