interface SearchableOrder {
  order_number: string;
  pickup_location: string | null;
  user: {
    nickname: string | null;
    phone: string | null;
    recipient_name: string | null;
  } | null;
}

export function matchesOrderSearch(
  order: SearchableOrder,
  query: string,
): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return true;
  }

  return (
    (order.user?.nickname ?? "").toLowerCase().includes(normalizedQuery) ||
    (order.user?.phone ?? "").includes(normalizedQuery) ||
    order.order_number.toLowerCase().includes(normalizedQuery) ||
    (order.user?.recipient_name ?? "").toLowerCase().includes(normalizedQuery)
  );
}

export function groupOrdersByPickup<
  T extends { pickup_location: string | null },
>(orders: T[]): Array<{ label: string; orders: T[] }> {
  const groups = new Map<string, T[]>();

  for (const order of orders) {
    const label = order.pickup_location?.trim() || "宅配";
    const existing = groups.get(label);
    if (existing) {
      existing.push(order);
    } else {
      groups.set(label, [order]);
    }
  }

  return Array.from(groups.entries()).map(([label, groupedOrders]) => ({
    label,
    orders: groupedOrders,
  }));
}
