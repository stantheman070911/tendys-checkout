import { STATUS_LABELS, STATUS_COLORS } from "@/constants";
import type { OrderStatus } from "@/types";

interface OrderStatusBadgeProps {
  status: OrderStatus;
}

export function OrderStatusBadge({ status }: OrderStatusBadgeProps) {
  const luxuryColors: Record<OrderStatus, string> = {
    pending_payment:
      "border-[rgba(184,132,71,0.25)] bg-[rgba(242,228,203,0.78)] text-[rgb(120,84,39)]",
    pending_confirm:
      "border-[rgba(101,131,118,0.22)] bg-[rgba(221,233,226,0.8)] text-[rgb(54,89,73)]",
    confirmed:
      "border-[rgba(95,126,92,0.2)] bg-[rgba(228,239,223,0.8)] text-[rgb(65,98,61)]",
    shipped:
      "border-[rgba(114,110,151,0.18)] bg-[rgba(230,228,242,0.82)] text-[rgb(74,70,113)]",
    cancelled:
      "border-[rgba(189,111,98,0.18)] bg-[rgba(246,225,220,0.84)] text-[rgb(140,67,56)]",
  };

  return (
    <span
      className={`lux-status-pill whitespace-nowrap ${luxuryColors[status] ?? STATUS_COLORS[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
