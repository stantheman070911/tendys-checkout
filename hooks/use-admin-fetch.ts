"use client";

import { useCallback } from "react";

export function useAdminFetch() {
  const adminFetch = useCallback(
    async <T = unknown>(url: string, options?: RequestInit): Promise<T> => {
      const headers = new Headers(options?.headers);
      if (options?.body && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
      }

      const res = await fetch(url, {
        ...options,
        credentials: "include",
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
    [],
  );

  return { adminFetch };
}
