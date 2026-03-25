"use client";

import { useCallback, useEffect, useRef } from "react";
import { getSupabaseBrowser } from "@/lib/auth/supabase-browser";

export function useAdminFetch() {
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowser();
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      tokenRef.current = data.session?.access_token ?? null;
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      tokenRef.current = session?.access_token ?? null;
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const resolveAccessToken = useCallback(async () => {
    if (tokenRef.current) {
      return tokenRef.current;
    }

    const supabase = getSupabaseBrowser();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    tokenRef.current = session?.access_token ?? null;
    return tokenRef.current;
  }, []);

  const adminFetch = useCallback(
    async <T = unknown>(url: string, options?: RequestInit): Promise<T> => {
      const token = await resolveAccessToken();

      if (!token) {
        throw new Error("Not authenticated");
      }

      const headers = new Headers(options?.headers);
      if (options?.body && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
      }
      headers.set("Authorization", `Bearer ${token}`);

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
        throw new Error(
          res.status === 401
            ? "Unauthorized"
            : `Request failed (${res.status})`,
        );
      }

      return payload as T;
    },
    [resolveAccessToken],
  );

  return { adminFetch };
}
