"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAdminSession } from "@/hooks/use-admin-session";
import { useAdminFetch } from "@/hooks/use-admin-fetch";
import { ADMIN_BASE } from "@/constants";
import type { Round } from "@/types";

const TABS: Array<[string, string, string]> = [
  ["dashboard", "📊", "儀表板"],
  ["orders", "📋", "訂單"],
  ["shipments", "📦", "出貨"],
  ["products", "🏷", "商品"],
  ["rounds", "🔄", "開團"],
  ["suppliers", "🏭", "供應商"],
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { session, loading, signOut } = useAdminSession();
  const { adminFetch } = useAdminFetch();
  const [round, setRound] = useState<Round | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  // Detect login page: pathname is exactly /admin (file system path from rewrite)
  const isLoginPage =
    pathname === "/admin" || pathname === ADMIN_BASE;

  // Fetch current round + pending count for nav
  useEffect(() => {
    if (!session || isLoginPage) return;
    adminFetch<{ rounds: Round[] }>("/api/rounds?all=true")
      .then(({ rounds }) => {
        const open = rounds.find((r) => r.is_open);
        if (open) {
          setRound(open);
          // Fetch pending confirm count for badge
          adminFetch<{ orders: Array<{ status: string }> }>(
            `/api/orders?roundId=${open.id}&status=pending_confirm`
          ).then(({ orders }) => setPendingCount(orders.length))
            .catch(() => {});
        }
      })
      .catch(() => {});
  }, [session, isLoginPage, adminFetch]);

  // Auth guard
  useEffect(() => {
    if (loading) return;
    if (!session && !isLoginPage) {
      router.replace(ADMIN_BASE);
    }
    if (session && isLoginPage) {
      router.replace(`${ADMIN_BASE}/dashboard`);
    }
  }, [loading, session, isLoginPage, router]);

  // Loading state
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  // Login page — no nav, just children
  if (isLoginPage) {
    return <>{children}</>;
  }

  // Not authenticated — show nothing while redirecting
  if (!session) return null;

  // Active tab detection
  const activeTab = TABS.find(([key]) =>
    pathname.includes(`/${key}`)
  )?.[0] ?? "dashboard";

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-indigo-700 text-white sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-3 pt-2 flex items-center gap-2">
          <span className="font-bold text-sm flex-1">Admin 後台</span>
          {round && (
            <span className="text-xs text-indigo-300 truncate max-w-[120px]">
              {round.name}
            </span>
          )}
          <button
            onClick={() => router.push(`${ADMIN_BASE}/orders?showPOS=1`)}
            className="bg-white text-indigo-700 px-3 py-1.5 rounded-xl text-sm font-bold shrink-0"
          >
            + 代客下單
          </button>
          <button
            onClick={signOut}
            className="text-indigo-300 hover:text-white text-sm px-2 py-1.5"
          >
            登出
          </button>
        </div>
        <div className="max-w-2xl mx-auto px-3 py-2 flex gap-1 overflow-x-auto">
          {TABS.map(([key, icon, label]) => (
            <button
              key={key}
              onClick={() =>
                router.push(
                  key === "dashboard"
                    ? `${ADMIN_BASE}/dashboard`
                    : `${ADMIN_BASE}/${key}`
                )
              }
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition ${
                activeTab === key
                  ? "bg-white text-indigo-700"
                  : "text-indigo-200 hover:bg-indigo-600"
              }`}
            >
              <span style={{ fontSize: "12px" }}>{icon}</span> {label}
              {key === "orders" && pendingCount > 0 && (
                <span className="bg-red-500 text-white rounded-full px-1.5 ml-0.5 text-xs leading-tight">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </header>

      <div className="max-w-2xl mx-auto p-3 pb-28">{children}</div>
    </div>
  );
}
