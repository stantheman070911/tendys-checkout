"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/auth/supabase-browser";
import { ADMIN_BASE } from "@/constants";
import { useToast } from "@/hooks/use-toast";

export default function AdminLoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
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
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!authRes.ok) {
        await supabase.auth.signOut();
        toast({
          title: authRes.status === 401 ? "沒有後台權限" : "登入失敗",
          description:
            authRes.status === 401
              ? "這個帳號已通過登入，但不在 ADMIN_EMAILS。請把該 email 加到 ADMIN_EMAILS（用逗號分隔）後重新部署。"
              : "後台權限驗證失敗，請檢查 ADMIN_EMAILS 與伺服器設定。",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      router.replace(`${ADMIN_BASE}/dashboard`);
    } catch {
      toast({
        title: "登入失敗",
        description: "網路錯誤，請稍後再試",
        variant: "destructive",
      });
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
      <form
        onSubmit={handleLogin}
        className="w-full max-w-sm bg-white rounded-xl border p-6 space-y-4"
      >
        <h1 className="text-xl font-bold text-center text-gray-800">
          Admin 登入
        </h1>
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border rounded-xl px-3 py-2.5 text-sm"
            placeholder="admin@example.com"
            required
            autoFocus
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">密碼</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border rounded-xl px-3 py-2.5 text-sm"
            placeholder="••••••••"
            required
          />
        </div>
        <button
          type="submit"
          disabled={submitting || !email.trim() || !password}
          className="w-full bg-indigo-600 text-white rounded-xl py-2.5 font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "登入中…" : "登入"}
        </button>
      </form>
    </main>
  );
}
