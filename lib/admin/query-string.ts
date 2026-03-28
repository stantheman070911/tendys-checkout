export function updateAdminQueryString(
  searchParams: URLSearchParams,
  updates: Record<string, string | null>,
) {
  const next = new URLSearchParams(searchParams.toString());

  for (const [key, value] of Object.entries(updates)) {
    if (!value) {
      next.delete(key);
    } else {
      next.set(key, value);
    }
  }

  const nextQuery = next.toString();
  return nextQuery ? `?${nextQuery}` : "";
}
