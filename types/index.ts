export type OrderStatus =
  | "pending_payment"
  | "pending_confirm"
  | "confirmed"
  | "shipped"
  | "cancelled";

export type NotificationType =
  | "payment_confirmed"
  | "shipment"
  | "product_arrival";

export type NotificationChannel = "line" | "email";
