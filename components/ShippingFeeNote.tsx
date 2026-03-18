import { formatCurrency } from "@/lib/utils";

interface ShippingFeeNoteProps {
  fee: number;
}

export function ShippingFeeNote({ fee }: ShippingFeeNoteProps) {
  return (
    <p className="text-sm text-muted-foreground">
      宅配到以上地址，運費 {formatCurrency(fee)}
    </p>
  );
}
