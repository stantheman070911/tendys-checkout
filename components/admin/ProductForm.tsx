"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import type { ProductWithProgress, Supplier } from "@/types";

interface ProductFormProps {
  open: boolean;
  onClose: () => void;
  product: ProductWithProgress | null; // null = create mode
  roundId: string;
  suppliers: Supplier[];
  adminFetch: <T = unknown>(url: string, options?: RequestInit) => Promise<T>;
  onSuccess: () => void;
}

export function ProductForm({
  open,
  onClose,
  product,
  roundId,
  suppliers,
  adminFetch,
  onSuccess,
}: ProductFormProps) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [unit, setUnit] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [stock, setStock] = useState("");
  const [goalQty, setGoalQty] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isEdit = product !== null;

  useEffect(() => {
    if (open && product) {
      setName(product.name);
      setPrice(String(product.price));
      setUnit(product.unit);
      setSupplierId(product.supplier_id ?? "");
      setStock(product.stock != null ? String(product.stock) : "");
      setGoalQty(product.goal_qty != null ? String(product.goal_qty) : "");
      setImageUrl(product.image_url ?? "");
    } else if (open) {
      setName("");
      setPrice("");
      setUnit("斤");
      setSupplierId("");
      setStock("");
      setGoalQty("");
      setImageUrl("");
    }
  }, [open, product]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !price || !unit.trim()) return;

    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        price: parseInt(price),
        unit: unit.trim(),
        supplier_id: supplierId || null,
        stock: stock ? parseInt(stock) : null,
        goal_qty: goalQty ? parseInt(goalQty) : null,
        image_url: imageUrl.trim() || null,
      };

      if (isEdit) {
        body.id = product.id;
        await adminFetch("/api/products", {
          method: "PUT",
          body: JSON.stringify(body),
        });
        toast({ title: "商品已更新" });
      } else {
        body.round_id = roundId;
        await adminFetch("/api/products", {
          method: "POST",
          body: JSON.stringify(body),
        });
        toast({ title: "商品已新增" });
      }

      onClose();
      onSuccess();
    } catch {
      toast({ title: "操作失敗", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "編輯商品" : "新增商品"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium uppercase tracking-[0.16em] text-[hsl(var(--bronze))]">
              品名
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="lux-input"
              required
            />
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium uppercase tracking-[0.16em] text-[hsl(var(--bronze))]">
                單價
              </label>
              <input
                type="number"
                min="1"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="lux-input"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium uppercase tracking-[0.16em] text-[hsl(var(--bronze))]">
                單位
              </label>
              <input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="lux-input"
                required
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium uppercase tracking-[0.16em] text-[hsl(var(--bronze))]">
              供應商
            </label>
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="lux-input bg-[rgba(255,251,246,0.9)]"
            >
              <option value="">（無）</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium uppercase tracking-[0.16em] text-[hsl(var(--bronze))]">
                庫存（空=不限）
              </label>
              <input
                type="number"
                min="0"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                className="lux-input"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium uppercase tracking-[0.16em] text-[hsl(var(--bronze))]">
                目標量（空=無目標）
              </label>
              <input
                type="number"
                min="1"
                value={goalQty}
                onChange={(e) => setGoalQty(e.target.value)}
                className="lux-input"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium uppercase tracking-[0.16em] text-[hsl(var(--bronze))]">
              圖片網址（選填）
            </label>
            <input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className="lux-input"
              placeholder="https://..."
            />
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-[1.1rem] border border-[rgba(177,140,92,0.28)] bg-[rgba(255,251,246,0.9)] py-3 text-sm font-semibold text-[hsl(var(--ink))]"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={submitting || !name.trim() || !price || !unit.trim()}
              className="flex-1 rounded-[1.1rem] bg-[hsl(var(--forest))] py-3 text-sm font-semibold text-[hsl(var(--mist))] disabled:opacity-50"
            >
              {submitting ? "儲存中…" : isEdit ? "更新" : "新增"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
