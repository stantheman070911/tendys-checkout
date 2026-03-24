import { formatCurrency } from "@/lib/utils";

interface ShippingFeeNoteProps {
  fee: number;
}

export function ShippingFeeNote({ fee }: ShippingFeeNoteProps) {
  return (
    <p className="text-sm text-[hsl(var(--muted-foreground))]">
      宅配到以上地址，另收 {formatCurrency(fee)}，面交則免運。
    </p>
  );
}
