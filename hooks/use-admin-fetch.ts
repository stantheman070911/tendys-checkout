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

      const headers = new Headers(options?.headers);
      if (options?.body && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
      }
      headers.set("Authorization", `Bearer ${session.access_token}`);

      const res = await fetch(url, {
        ...options,
        headers,
      });

      const contentType = res.headers.get("content-type") ?? "";
      const payload = contentType.includes("application/json")
        ? ((await res.json()) as T | { error?: string })
        : ((await res.text()) as T);

      if (!res.ok) {
        if (
          typeof payload === "object" &&
          payload !== null &&
          "error" in payload &&
          typeof payload.error === "string"
        ) {
          throw new Error(payload.error);
        }
        throw new Error(res.status === 401 ? "Unauthorized" : `Request failed (${res.status})`);
      }

      return payload as T;
    },
    []
  );

  return { adminFetch };
}
