"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { buildAdminPath } from "@/lib/admin/paths";
import { updateAdminQueryString } from "@/lib/admin/query-string";

export function useAdminQueryControls(args: {
  path: string;
  initialSearch: string;
  debounceMs?: number;
}) {
  const { path, initialSearch, debounceMs = 250 } = args;
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchDraft, setSearchDraft] = useState(initialSearch);

  useEffect(() => {
    setSearchDraft(initialSearch);
  }, [initialSearch]);

  useEffect(() => {
    const trimmed = searchDraft.trim();
    const current = searchParams.get("q") ?? "";
    if (trimmed === current) {
      return;
    }

    const timer = window.setTimeout(() => {
      const nextSearch = updateAdminQueryString(
        new URLSearchParams(searchParams.toString()),
        {
          q: trimmed || null,
          page: "1",
        },
      );
      router.replace(`${buildAdminPath(path)}${nextSearch}`, {
        scroll: false,
      });
    }, debounceMs);

    return () => window.clearTimeout(timer);
  }, [debounceMs, path, router, searchDraft, searchParams]);

  function navigateWithUpdates(updates: Record<string, string | null>) {
    const nextSearch = updateAdminQueryString(
      new URLSearchParams(searchParams.toString()),
      updates,
    );
    router.push(`${buildAdminPath(path)}${nextSearch}`, { scroll: false });
  }

  return {
    searchDraft,
    setSearchDraft,
    navigateWithUpdates,
  };
}
