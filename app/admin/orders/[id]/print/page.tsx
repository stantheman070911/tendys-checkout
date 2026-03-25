import { AutoPrint } from "@/components/admin/AutoPrint";
import { requireAdminPageSession } from "@/lib/admin/server";
import { getOrderWithItems } from "@/lib/db/orders";
import { formatCurrency } from "@/lib/utils";

export default async function PrintOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminPageSession();

  const { id } = await params;
  const order = await getOrderWithItems(id);

  if (!order) {
    return (
      <div className="p-8 text-center text-red-500">
        Order not found
      </div>
    );
  }

  const statusLabel =
    order.status === "pending_payment"
      ? "待匯款"
      : order.status === "pending_confirm"
        ? "待確認"
        : order.status === "confirmed"
          ? "待出貨"
          : order.status === "shipped"
            ? "已出貨"
            : "已取消";

  return (
    <div className="p-8 max-w-2xl mx-auto bg-white min-h-screen text-black">
      <AutoPrint />
      <div className="mb-8 text-center border-b pb-4">
        <h1 className="text-2xl font-bold mb-2">Tendy Checkout 裝箱單</h1>
        <p className="font-mono text-gray-500">{order.order_number}</p>
      </div>

      <div className="grid grid-cols-2 gap-8 mb-8">
        <div>
          <h2 className="text-sm font-bold text-gray-500 mb-2 border-b pb-1">
            收件資訊
          </h2>
          <p className="font-medium text-lg">
            {order.user?.recipient_name ?? "—"}
          </p>
          <p className="text-gray-700">
            訂購人：{order.user?.purchaser_name ?? "—"}
          </p>
          <p className="text-gray-700">{order.user?.phone ?? "—"}</p>
          {order.pickup_location ? (
            <p className="text-purple-600 mt-1 font-medium">
              📍 面交：{order.pickup_location}
            </p>
          ) : (
            <p className="text-blue-600 mt-1 font-medium">
              🚚 宅配：{order.user?.address ?? "—"}
            </p>
          )}
        </div>
        <div>
          <h2 className="text-sm font-bold text-gray-500 mb-2 border-b pb-1">
            訂單資訊
          </h2>
          <p className="text-gray-700 mb-1">
            暱稱：{order.user?.nickname ?? "—"}
          </p>
          <p className="text-gray-700 mb-1">狀態：{statusLabel}</p>
          {order.note && (
            <p className="text-orange-600 font-medium">備註：{order.note}</p>
          )}
        </div>
      </div>

      <h2 className="text-sm font-bold text-gray-500 mb-2 border-b pb-1">
        商品明細
      </h2>
      <div className="space-y-2 mb-8 border-b pb-4">
        {order.order_items.map((item) => (
          <div
            key={item.id}
            className="flex justify-between items-center text-lg py-1"
          >
            <span className="font-medium">
              <input type="checkbox" className="mr-3 w-4 h-4" />
              {item.product_name}
            </span>
            <span className="font-bold border-2 border-black rounded px-3 py-0.5">
              × {item.quantity}
            </span>
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-12 font-bold text-lg">
        {order.shipping_fee != null && order.shipping_fee > 0 && (
          <div className="text-gray-500">
            運費：{formatCurrency(order.shipping_fee)}
          </div>
        )}
        <div className="text-xl">總計：{formatCurrency(order.total_amount)}</div>
      </div>
    </div>
  );
}
