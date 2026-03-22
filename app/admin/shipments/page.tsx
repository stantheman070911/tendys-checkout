/**
 * PHASE 6.1 — Shipments Management (待出貨管理)
 *
 * Pattern: follow orders/page.tsx
 *
 * New component needed: components/admin/ShipmentCard.tsx
 *   - Simplified order card (always expanded, no payment info, delivery-focused)
 *
 * Data: GET /api/orders?roundId=X&status=confirmed
 *
 * Features:
 *   1. Group orders by pickup_location (null/empty → "宅配", else value)
 *   2. Collapsible sections per group (default expanded)
 *   3. Client-side search/filter: nickname, phone, order number
 *   4. Card fields: order number, recipient, phone, address/pickup, items, total, shipping fee
 *   5. Single confirm: "確認寄出"(宅配) / "確認取貨"(面交) → POST /api/confirm-shipment
 *   6. Checkbox multi-select + sticky bottom bar "批次確認出貨" → batch POST /api/confirm-shipment
 *   7. Inline LINE/Email success badges after confirm
 *   8. "列印全部" → window.print() with @media print styles
 *
 * Reusable from codebase:
 *   - useAdminFetch (admin/layout.tsx)
 *   - Set<string> batch selection pattern (orders page)
 *   - Sticky bottom bar (orders page)
 *   - Toast feedback (orders page)
 */
export default function ShipmentsPage() {
  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold">待出貨管理 — Coming Soon</h1>
    </main>
  );
}
