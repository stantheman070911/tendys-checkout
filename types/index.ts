// ─── Status & Channel Unions ────────────────────────────────

export type OrderStatus =
  | "pending_payment"
  | "pending_confirm"
  | "confirmed"
  | "shipped"
  | "cancelled";

export type NotificationType =
  | "payment_confirmed"
  | "shipment"
  | "product_arrival"
  | "order_cancelled";

export type NotificationChannel = "line" | "email";
export type NotificationLogStatus = "success" | "failed" | "skipped";

// ─── Entity Interfaces ─────────────────────────────────────

export interface Round {
  id: string;
  name: string;
  is_open: boolean;
  deadline: string | null;
  shipping_fee: number | null;
  pickup_option_a: string;
  pickup_option_b: string;
  created_at: string;
}

export interface Supplier {
  id: string;
  name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  round_id: string | null;
  supplier_id: string | null;
  name: string;
  price: number;
  unit: string;
  is_active: boolean;
  stock: number | null;
  goal_qty: number | null;
  image_url: string | null;
  created_at: string;
}

export interface User {
  id: string;
  nickname: string;
  recipient_name: string | null;
  phone: string | null;
  address: string | null;
  email: string | null;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  order_number: string;
  user_id: string | null;
  round_id: string | null;
  total_amount: number;
  shipping_fee: number | null;
  status: OrderStatus;
  payment_amount: number | null;
  payment_last5: string | null;
  payment_reported_at: string | null;
  confirmed_at: string | null;
  shipped_at: string | null;
  note: string | null;
  pickup_location: string | null;
  cancel_reason: string | null;
  submission_key: string | null;
  line_user_id: string | null;
  created_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  unit_price: number;
  quantity: number;
  subtotal: number;
}

export interface NotificationLog {
  id: string;
  order_id: string | null;
  round_id: string | null;
  product_id: string | null;
  channel: NotificationChannel;
  type: NotificationType;
  status: NotificationLogStatus;
  error_message: string | null;
  created_at: string;
}

// ─── Request Types ──────────────────────────────────────────

export interface CartItem {
  product_id: string;
  product_name: string;
  unit_price: number;
  quantity: number;
  subtotal: number;
}

export interface OrderSubmitRequest {
  round_id: string;
  nickname: string;
  recipient_name: string;
  phone: string;
  address?: string;
  email?: string;
  pickup_location: string;
  items: CartItem[];
  submission_key: string;
  note?: string;
}

export interface PaymentReportRequest {
  order_number: string;
  recipient_name: string;
  phone_last3: string;
  payment_amount: number;
  payment_last5: string;
}

// ─── Composite Types ────────────────────────────────────────

export interface ProductWithProgress extends Product {
  supplier_name: string | null;
  current_qty: number;
  progress_pct: number | null;
}

// ─── View Types ─────────────────────────────────────────────

export interface ProductProgress {
  product_id: string;
  name: string;
  goal_qty: number | null;
  supplier_id: string | null;
  current_qty: number;
  progress_pct: number | null;
}

export interface OrderByProduct {
  product_id: string;
  product_name: string;
  nickname: string;
  recipient_name: string | null;
  phone: string | null;
  quantity: number;
  subtotal: number;
  order_number: string;
  status: OrderStatus;
  pickup_location: string | null;
  round_id: string;
}

// ─── Phase 6: Shipments Page Types ─────────────────────────

export type OrderWithItems = Order & {
  order_items: OrderItem[];
  user: User | null;
};
