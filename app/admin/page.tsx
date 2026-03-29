import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_BASE } from "@/constants";
import { ADMIN_SESSION_COOKIE_NAME, readAdminSessionValue } from "@/lib/auth/supabase-admin";
import { AdminLoginForm } from "@/components/admin/AdminLoginForm";

export default async function AdminLoginPage() {
  const cookieStore = await cookies();
  const session = await readAdminSessionValue(
    cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value,
  );

  if (session) {
    redirect(`${ADMIN_BASE}/dashboard`);
  }

  return <AdminLoginForm />;
}
