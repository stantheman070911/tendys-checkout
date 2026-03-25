import type {
  AdminOrderDetail,
  AdminOrderListRow,
  AdminOrderListUser,
  OrderStatus,
} from "@/types";

type OrderPreviewItem = {
  product_name: string;
  quantity: number;
};

type OrderPreviewSource = {
  id: string;
  order_number: string;
  round_id: string | null;
  total_amount: number;
  shipping_fee: number | null;
  status: OrderStatus | string;
  payment_amount: number | null;
  payment_last5: string | null;
  payment_reported_at: string | Date | null;
  confirmed_at: string | Date | null;
  shipped_at: string | Date | null;
  pickup_location: string | null;
  created_at: string | Date;
  user: AdminOrderListUser | null;
  order_items?: OrderPreviewItem[];
  items_preview?: string | null;
};

function serializeDate(value: string | Date | null): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.toISOString();
}

export function buildOrderItemsPreview(items: OrderPreviewItem[]): string {
  return items.map((item) => `${item.product_name} ×${item.quantity}`).join("、");
}

export function toAdminOrderListRow(order: OrderPreviewSource): AdminOrderListRow {
  return {
    id: order.id,
    order_number: order.order_number,
    round_id: order.round_id,
    total_amount: order.total_amount,
    shipping_fee: order.shipping_fee,
    status: order.status as OrderStatus,
    payment_amount: order.payment_amount,
    payment_last5: order.payment_last5,
    payment_reported_at: serializeDate(order.payment_reported_at),
    confirmed_at: serializeDate(order.confirmed_at),
    shipped_at: serializeDate(order.shipped_at),
    pickup_location: order.pickup_location,
    created_at:
      typeof order.created_at === "string"
        ? order.created_at
        : order.created_at.toISOString(),
    user: order.user,
    items_preview:
      order.items_preview ??
      buildOrderItemsPreview(order.order_items ?? []),
  };
}

export function detailToAdminOrderListRow(order: AdminOrderDetail): AdminOrderListRow {
  return toAdminOrderListRow(order);
}
