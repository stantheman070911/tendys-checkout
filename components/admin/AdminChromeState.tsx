"use client";

import {
  createContext,
  useEffect,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

interface AdminChromeContextValue {
  pendingCount: number;
  setPendingCount: Dispatch<SetStateAction<number>>;
}

const AdminChromeContext = createContext<AdminChromeContextValue | null>(null);

export function AdminChromeProvider({
  initialPendingCount,
  children,
}: {
  initialPendingCount: number;
  children: ReactNode;
}) {
  const [pendingCount, setPendingCount] = useState(initialPendingCount);

  useEffect(() => {
    setPendingCount(initialPendingCount);
  }, [initialPendingCount]);

  const value = useMemo(
    () => ({
      pendingCount,
      setPendingCount,
    }),
    [pendingCount],
  );

  return (
    <AdminChromeContext.Provider value={value}>
      {children}
    </AdminChromeContext.Provider>
  );
}

export function useAdminChrome() {
  const context = useContext(AdminChromeContext);
  if (!context) {
    throw new Error("useAdminChrome must be used within AdminChromeProvider");
  }
  return context;
}

export function AdminPendingCountBadge({
  isActive,
}: {
  isActive: boolean;
}) {
  const { pendingCount } = useAdminChrome();

  if (pendingCount <= 0) {
    return null;
  }

  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        isActive
          ? "bg-white/16 text-white"
          : "bg-[rgba(189,111,98,0.16)] text-[rgb(140,67,56)]"
      }`}
    >
      {pendingCount}
    </span>
  );
}
