"use client";

import { useCallback } from "react";
import { getSupabaseBrowser } from "@/lib/auth/supabase-browser";

export function useAdminFetch() {
  const adminFetch = useCallback(
    async <T = unknown>(
      url: string,
      options?: RequestInit
    ): Promise<T> => {
      const supabase = getSupabaseBrowser();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Not authenticated");
      }

      const res = await fetch(url, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          ...options?.headers,
        },
      });

      if (res.status === 401) {
        throw new Error("Unauthorized");
      }

      return res.json() as Promise<T>;
    },
    []
  );

  return { adminFetch };
}
