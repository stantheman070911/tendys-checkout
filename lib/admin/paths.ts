import { ADMIN_BASE } from "@/constants";

export function buildAdminPath(path = ""): string {
  if (!path || path === "/") {
    return ADMIN_BASE;
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${ADMIN_BASE}${normalizedPath}`;
}
