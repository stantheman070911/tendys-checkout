"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAdminFetch } from "@/hooks/use-admin-fetch";
import type { Round } from "@/types";

interface AdminRoundContextValue {
  round: Round | null;
  pendingCount: number;
  loading: boolean;
  error: string | null;
  refreshRound: () => Promise<void>;
}

const AdminRoundContext = createContext<AdminRoundContextValue | null>(null);

export function AdminRoundProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { adminFetch } = useAdminFetch();
  const [round, setRound] = useState<Round | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshRound = useCallback(async () => {
    setError(null);

    try {
      const { rounds } = await adminFetch<{ rounds: Round[] }>(
        "/api/rounds?all=true",
      );
      const openRound = rounds.find((entry) => entry.is_open) ?? null;
      setRound(openRound);

      if (!openRound) {
        setPendingCount(0);
        return;
      }

      const { orders } = await adminFetch<{ orders: Array<{ id: string }> }>(
        `/api/orders?roundId=${openRound.id}&status=pending_confirm`,
      );
      setPendingCount(orders.length);
    } catch (nextError) {
      setRound(null);
      setPendingCount(0);
      setError(
        nextError instanceof Error ? nextError.message : "資料載入失敗",
      );
    } finally {
      setLoading(false);
    }
  }, [adminFetch]);

  useEffect(() => {
    void refreshRound();
  }, [refreshRound]);

  const value = useMemo<AdminRoundContextValue>(
    () => ({
      round,
      pendingCount,
      loading,
      error,
      refreshRound,
    }),
    [round, pendingCount, loading, error, refreshRound],
  );

  return (
    <AdminRoundContext.Provider value={value}>
      {children}
    </AdminRoundContext.Provider>
  );
}

export function useAdminRound() {
  const context = useContext(AdminRoundContext);
  if (!context) {
    throw new Error("useAdminRound must be used within AdminRoundProvider");
  }
  return context;
}
