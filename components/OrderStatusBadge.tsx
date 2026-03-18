import { STATUS_LABELS, STATUS_COLORS } from "@/constants";
import type { OrderStatus } from "@/types";

interface OrderStatusBadgeProps {
  status: OrderStatus;
}

export function OrderStatusBadge({ status }: OrderStatusBadgeProps) {
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${STATUS_COLORS[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
