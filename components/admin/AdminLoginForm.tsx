"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/auth/supabase-browser";
import { ADMIN_BASE } from "@/constants";
import { useToast } from "@/hooks/use-toast";

export function AdminLoginForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    if (!email.trim() || !password) return;

    setSubmitting(true);
    try {
      const supabase = getSupabaseBrowser();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        toast({
          title: "登入失敗",
          description: error.message,
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      const accessToken = data.session?.access_token;
      if (!accessToken) {
        toast({
          title: "登入失敗",
          description: "登入成功但未取得 session，請稍後再試",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      const authRes = await fetch("/api/admin/session", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        credentials: "include",
      });

      if (!authRes.ok) {
        await supabase.auth.signOut();
        toast({
          title: authRes.status === 401 ? "沒有後台權限" : "登入失敗",
          description:
            authRes.status === 401
              ? "這個帳號已通過登入，但不在 ADMIN_EMAILS。請把該 email 加到 ADMIN_EMAILS 後重新部署。"
              : "後台權限驗證失敗，請檢查 ADMIN_EMAILS 與伺服器設定。",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      router.replace(`${ADMIN_BASE}/dashboard`);
      router.refresh();
    } catch {
      toast({
        title: "登入失敗",
        description: "網路錯誤，請稍後再試",
        variant: "destructive",
      });
      setSubmitting(false);
    }
  }

  return (
    <main className="lux-shell flex items-center justify-center px-4">
      <form
        onSubmit={handleLogin}
        className="lux-panel-strong w-full max-w-md space-y-5 p-6 md:p-8"
      >
        <div className="space-y-2 text-center">
          <div className="lux-kicker">Admin Atelier</div>
          <h1 className="font-display text-3xl text-[hsl(var(--ink))]">
            Admin 登入
          </h1>
          <p className="text-sm leading-6 text-[hsl(var(--muted-foreground))]">
            使用管理員帳號登入後台，處理訂單、出貨與供應商協作。
          </p>
        </div>
        <div className="space-y-2">
          <label className="text-xs font-medium uppercase tracking-[0.16em] text-[hsl(var(--bronze))]">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="lux-input"
            placeholder="admin@example.com"
            required
            autoFocus
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-medium uppercase tracking-[0.16em] text-[hsl(var(--bronze))]">
            密碼
          </label>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="lux-input"
            placeholder="••••••••"
            required
          />
        </div>
        <button
          type="submit"
          disabled={submitting || !email.trim() || !password}
          className="w-full rounded-[1.2rem] bg-[hsl(var(--forest))] py-3 text-sm font-semibold text-[hsl(var(--mist))] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "登入中…" : "登入"}
        </button>
      </form>
    </main>
  );
}
