import type { AdminOrderDetail } from "@/types";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildShipmentPrintDocument(
  orders: AdminOrderDetail[],
): string {
  const slips = orders
    .map(
      (order) => `
        <div class="slip">
          <h2>${escapeHtml(order.order_number)}</h2>
          <div class="info">
            <div><b>暱稱：</b>${escapeHtml(order.user?.nickname ?? "—")}</div>
            <div><b>訂購人：</b>${escapeHtml(order.user?.purchaser_name ?? "—")}</div>
            <div><b>收貨人：</b>${escapeHtml(order.user?.recipient_name ?? "—")} · ${escapeHtml(order.user?.phone ?? "—")}</div>
            <div>${order.pickup_location ? `📍 ${escapeHtml(order.pickup_location)}` : `🚚 ${escapeHtml(order.user?.address ?? "—")}`}</div>
          </div>
          <table>
            <thead><tr><th>品名</th><th>數量</th><th>小計</th></tr></thead>
            <tbody>
              ${order.order_items
                .map(
                  (item) =>
                    `<tr><td>${escapeHtml(item.product_name)}</td><td>${item.quantity}</td><td>$${item.subtotal}</td></tr>`,
                )
                .join("")}
              ${order.shipping_fee ? `<tr><td>宅配運費</td><td></td><td>$${order.shipping_fee}</td></tr>` : ""}
            </tbody>
            <tfoot><tr><td colspan="2"><b>合計</b></td><td><b>$${order.total_amount}</b></td></tr></tfoot>
          </table>
        </div>
      `,
    )
    .join("");

  return `
    <html>
      <head>
        <title>待出貨裝箱單</title>
        <style>
          body { font-family: sans-serif; padding: 0; margin: 0; color: #111827; }
          .slip { padding: 24px; page-break-after: always; }
          .slip:last-child { page-break-after: auto; }
          h2 { margin: 0 0 8px; font-size: 18px; }
          .info { margin-bottom: 12px; font-size: 14px; }
          table { width: 100%; border-collapse: collapse; font-size: 14px; }
          th, td { border: 1px solid #d1d5db; padding: 6px 8px; text-align: left; }
          th { background: #f3f4f6; }
          tfoot td { border-top: 2px solid #111827; }
        </style>
      </head>
      <body>${slips}</body>
      <script>window.onload = function () { window.print(); };</script>
    </html>
  `;
}
