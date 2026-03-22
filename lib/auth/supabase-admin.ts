import { createClient, SupabaseClient } from "@supabase/supabase-js";

let adminClient: SupabaseClient | null = null;
let anonClient: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (adminClient) return adminClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase admin env vars");
  }
  adminClient = createClient(url, key);
  return adminClient;
}

export function getSupabaseAnon(): SupabaseClient {
  if (anonClient) return anonClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase anon env vars");
  }
  anonClient = createClient(url, key);
  return anonClient;
}

export async function verifyAdminSession(request: Request): Promise<boolean> {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) return false;

    const token = authHeader.slice(7);
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user || !data.user.email) return false;

    const allowedEmailsStr = process.env.ADMIN_EMAILS || "";
    const allowedEmails = allowedEmailsStr
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    return allowedEmails.includes(data.user.email.toLowerCase());
  } catch {
    return false;
  }
}
