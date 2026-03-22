"use client";

import { useState, useEffect } from "react";
import { Session } from "@supabase/supabase-js";
import { getSupabaseBrowser } from "@/lib/auth/supabase-browser";
import { ADMIN_BASE } from "@/constants";

export function useAdminSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = getSupabaseBrowser();

    let active = true;

    async function verifySession(nextSession: Session | null) {
      if (!active) return;

      if (!nextSession?.access_token) {
        setSession(null);
        setAuthorized(false);
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const res = await fetch("/api/admin/session", {
          headers: {
            Authorization: `Bearer ${nextSession.access_token}`,
          },
        });

        if (!active) return;

        if (!res.ok) {
          await supabase.auth.signOut();
          if (!active) return;
          setSession(null);
          setAuthorized(false);
          setLoading(false);
          return;
        }

        setSession(nextSession);
        setAuthorized(true);
      } catch {
        if (!active) return;
        setSession(null);
        setAuthorized(false);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    supabase.auth.getSession().then(({ data }) => {
      void verifySession(data.session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      void verifySession(newSession);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    const supabase = getSupabaseBrowser();
    await supabase.auth.signOut();
    setSession(null);
    setAuthorized(false);
    window.location.href = ADMIN_BASE;
  };

  return { session, authorized, loading, signOut };
}
