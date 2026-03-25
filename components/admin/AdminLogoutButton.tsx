"use client";

import { getSupabaseBrowser } from "@/lib/auth/supabase-browser";
import { ADMIN_BASE } from "@/constants";

export function AdminLogoutButton() {
  async function handleSignOut() {
    try {
      await fetch("/api/admin/session", {
        method: "DELETE",
        credentials: "include",
      });
    } finally {
      const supabase = getSupabaseBrowser();
      await supabase.auth.signOut();
      window.location.href = ADMIN_BASE;
    }
  }

  return (
    <button
      onClick={handleSignOut}
      className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-[rgba(177,140,92,0.24)] bg-[rgba(255,251,246,0.88)] px-4 py-2.5 text-sm font-medium text-[hsl(var(--muted-foreground))]"
    >
      登出
    </button>
  );
}
