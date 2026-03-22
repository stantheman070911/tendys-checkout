/**
 * PHASE 6.2 — Supplier Management (供應商管理)
 *
 * Pattern: follow products/page.tsx + ProductAggregationTable.tsx
 *
 * New component needed: components/admin/SupplierForm.tsx
 *   - Dialog form for supplier CRUD (name, contact_name, phone, email, note)
 *   - Pattern: follow ProductForm.tsx
 *
 * Data:
 *   - GET /api/suppliers
 *   - GET /api/products?roundId=X&all=true
 *   - GET /api/orders-by-product?productId=X&roundId=Y (drill-down)
 *
 * Features:
 *   1. Card list: name, contact_name, phone, email, product count badge
 *   2. Create/edit via SupplierForm dialog → POST/PUT /api/suppliers
 *   3. Delete with confirmation → DELETE /api/suppliers?id=X (error if products linked)
 *   4. Click supplier → expand products (filter by supplier_id)
 *   5. Product row: name, progress bar, total ordered qty
 *   6. Click product → expand customer list (nickname, recipient_name, phone, qty, order #)
 *   7. "通知到貨" per product → POST /api/notify-arrival (same pattern as ProductAggregationTable)
 */
export default function SuppliersPage() {
  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold">供應商管理 — Coming Soon</h1>
    </main>
  );
}
