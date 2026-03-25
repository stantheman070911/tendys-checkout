"use client";

import { useState, useEffect } from "react";
import { Session } from "@supabase/supabase-js";
import { getSupabaseBrowser } from "@/lib/auth/supabase-browser";
import { ADMIN_BASE } from "@/constants";

const AUTH_CACHE_KEY = "admin-auth-cache";

function getAccessTokenCacheValue(accessToken: string): string | null {
  const [, payload] = accessToken.split(".");
  if (!payload) return null;

  try {
    const normalizedPayload = payload.replace(/-/g, "+").replace(/_/g, "/");
    const paddedPayload = normalizedPayload.padEnd(
      normalizedPayload.length + ((4 - (normalizedPayload.length % 4)) % 4),
      "=",
    );
    const parsed = JSON.parse(window.atob(paddedPayload)) as {
      sub?: string;
      exp?: number;
    };

    if (!parsed.sub || typeof parsed.exp !== "number") {
      return null;
    }

    return `${parsed.sub}:${parsed.exp}`;
  } catch {
    return null;
  }
}

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

      const cacheValue = getAccessTokenCacheValue(nextSession.access_token);
      if (
        cacheValue &&
        sessionStorage.getItem(AUTH_CACHE_KEY) === cacheValue
      ) {
        setSession(nextSession);
        setAuthorized(true);
        setLoading(false);
        return;
      }

      try {
        const res = await fetch("/api/admin/session", {
          headers: {
            Authorization: `Bearer ${nextSession.access_token}`,
          },
        });

        if (!active) return;

        if (!res.ok) {
          if (cacheValue) {
            sessionStorage.removeItem(AUTH_CACHE_KEY);
          }
          await supabase.auth.signOut();
          if (!active) return;
          setSession(null);
          setAuthorized(false);
          setLoading(false);
          return;
        }

        setSession(nextSession);
        setAuthorized(true);
        if (cacheValue) {
          sessionStorage.setItem(AUTH_CACHE_KEY, cacheValue);
        }
      } catch {
        if (!active) return;
        if (cacheValue) {
          sessionStorage.removeItem(AUTH_CACHE_KEY);
        }
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
    sessionStorage.removeItem(AUTH_CACHE_KEY);
    setSession(null);
    setAuthorized(false);
    window.location.href = ADMIN_BASE;
  };

  return { session, authorized, loading, signOut };
}
