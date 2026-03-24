"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ClipboardList,
  Factory,
  LayoutDashboard,
  PackageCheck,
  RefreshCw,
  Tag,
} from "lucide-react";
import { useAdminSession } from "@/hooks/use-admin-session";
import { useAdminFetch } from "@/hooks/use-admin-fetch";
import { ADMIN_BASE } from "@/constants";
import type { Round } from "@/types";

const TABS: Array<{
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { key: "dashboard", label: "儀表板", icon: LayoutDashboard },
  { key: "orders", label: "訂單", icon: ClipboardList },
  { key: "shipments", label: "出貨", icon: PackageCheck },
  { key: "products", label: "商品", icon: Tag },
  { key: "rounds", label: "開團", icon: RefreshCw },
  { key: "suppliers", label: "供應商", icon: Factory },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { session, authorized, loading, signOut } = useAdminSession();
  const { adminFetch } = useAdminFetch();
  const [round, setRound] = useState<Round | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  // Detect login page: pathname is exactly /admin (file system path from rewrite)
  const isLoginPage = pathname === "/admin" || pathname === ADMIN_BASE;

  // Fetch current round + pending count for nav
  useEffect(() => {
    if (!session || !authorized || isLoginPage) return;
    adminFetch<{ rounds: Round[] }>("/api/rounds?all=true")
      .then(({ rounds }) => {
        const open = rounds.find((r) => r.is_open);
        if (open) {
          setRound(open);
          // Fetch pending confirm count for badge
          adminFetch<{ orders: Array<{ status: string }> }>(
            `/api/orders?roundId=${open.id}&status=pending_confirm`,
          )
            .then(({ orders }) => setPendingCount(orders.length))
            .catch(() => {});
        }
      })
      .catch(() => {});
  }, [session, authorized, isLoginPage, adminFetch]);

  // Auth guard
  useEffect(() => {
    if (loading) return;
    if ((!session || !authorized) && !isLoginPage) {
      router.replace(ADMIN_BASE);
    }
    if (session && authorized && isLoginPage) {
      router.replace(`${ADMIN_BASE}/dashboard`);
    }
  }, [loading, session, authorized, isLoginPage, router]);

  // Loading state
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[hsl(var(--forest))] border-t-transparent" />
      </div>
    );
  }

  // Login page — no nav, just children
  if (isLoginPage) {
    return <>{children}</>;
  }

  // Not authenticated — show nothing while redirecting
  if (!session || !authorized) return null;

  // Active tab detection
  const activeTab =
    TABS.find(({ key }) => pathname.includes(`/${key}`))?.key ?? "dashboard";

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
                {round && (
                  <span className="lux-pill">
                    開團中 · {round.name}
                  </span>
                )}
              </div>
            </div>

            <div className="lux-action-row">
              <button
                onClick={() => router.push(`${ADMIN_BASE}/orders?showPOS=1`)}
                className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-[hsl(var(--forest))] px-5 py-2.5 text-sm font-semibold text-[hsl(var(--mist))]"
              >
                新增代客訂單
              </button>
              <button
                onClick={signOut}
                className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-[rgba(177,140,92,0.24)] bg-[rgba(255,251,246,0.88)] px-4 py-2.5 text-sm font-medium text-[hsl(var(--muted-foreground))]"
              >
                登出
              </button>
            </div>
          </div>

          <div className="lux-panel flex gap-2 overflow-x-auto p-2">
            {TABS.map(({ key, icon: Icon, label }) => (
              <button
                key={key}
                onClick={() =>
                  router.push(
                    key === "dashboard"
                      ? `${ADMIN_BASE}/dashboard`
                      : `${ADMIN_BASE}/${key}`,
                  )
                }
                className={`inline-flex min-h-[46px] items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium whitespace-nowrap transition ${
                  activeTab === key
                    ? "bg-[hsl(var(--forest))] text-[hsl(var(--mist))] shadow-[0_18px_36px_-28px_rgba(22,31,26,0.75)]"
                    : "text-[hsl(var(--muted-foreground))] hover:bg-[rgba(236,224,205,0.4)] hover:text-[hsl(var(--ink))]"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
                {key === "orders" && pendingCount > 0 && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      activeTab === key
                        ? "bg-white/16 text-white"
                        : "bg-[rgba(189,111,98,0.16)] text-[rgb(140,67,56)]"
                    }`}
                  >
                    {pendingCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="lux-page pb-32">{children}</div>
    </div>
  );
}
