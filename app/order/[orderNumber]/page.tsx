import { PublicOrderPage } from "@/components/PublicOrderPage";

export default async function OrderPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = await params;

  return (
    <PublicOrderPage orderNumber={decodeURIComponent(orderNumber).toUpperCase()} />
  );
}
