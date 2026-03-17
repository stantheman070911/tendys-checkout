export const ORDER_STATUS = {
  PENDING_PAYMENT: "pending_payment",
  PENDING_CONFIRM: "pending_confirm",
  CONFIRMED: "confirmed",
  SHIPPED: "shipped",
  CANCELLED: "cancelled",
} as const;

export const STATUS_LABELS: Record<string, string> = {
  pending_payment: "待付款",
  pending_confirm: "待確認",
  confirmed: "已確認",
  shipped: "已出貨",
  cancelled: "已取消",
};

export const STATUS_COLORS: Record<string, string> = {
  pending_payment: "bg-yellow-100 text-yellow-800",
  pending_confirm: "bg-blue-100 text-blue-800",
  confirmed: "bg-green-100 text-green-800",
  shipped: "bg-purple-100 text-purple-800",
  cancelled: "bg-gray-100 text-gray-500",
};

export const NOTIFICATION_TYPES = {
  PAYMENT_CONFIRMED: "payment_confirmed",
  SHIPMENT: "shipment",
  PRODUCT_ARRIVAL: "product_arrival",
} as const;

export const PICKUP_OPTIONS = [
  { value: "", label: "宅配到以上地址" },
  { value: "面交點 A", label: "面交點 A" },
  { value: "面交點 B", label: "面交點 B" },
];
