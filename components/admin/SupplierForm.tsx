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
import type { Supplier } from "@/types";

interface SupplierFormProps {
  open: boolean;
  onClose: () => void;
  supplier: Supplier | null; // null = create mode
  adminFetch: <T = unknown>(url: string, options?: RequestInit) => Promise<T>;
  onSuccess: () => void;
}

export function SupplierForm({
  open,
  onClose,
  supplier,
  adminFetch,
  onSuccess,
}: SupplierFormProps) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isEdit = supplier !== null;

  useEffect(() => {
    if (open && supplier) {
      setName(supplier.name);
      setContactName(supplier.contact_name ?? "");
      setPhone(supplier.phone ?? "");
      setEmail(supplier.email ?? "");
      setNote(supplier.note ?? "");
    } else if (open) {
      setName("");
      setContactName("");
      setPhone("");
      setEmail("");
      setNote("");
    }
  }, [open, supplier]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        contact_name: contactName.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        note: note.trim() || null,
      };

      if (isEdit) {
        body.id = supplier.id;
        await adminFetch("/api/suppliers", {
          method: "PUT",
          body: JSON.stringify(body),
        });
        toast({ title: "供應商已更新" });
      } else {
        await adminFetch("/api/suppliers", {
          method: "POST",
          body: JSON.stringify(body),
        });
        toast({ title: "供應商已新增" });
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
          <DialogTitle>{isEdit ? "編輯供應商" : "新增供應商"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">
              供應商名稱
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border rounded-xl px-3 py-2.5 text-sm"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">
                聯絡人
              </label>
              <input
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="w-full border rounded-xl px-3 py-2.5 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">電話</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full border rounded-xl px-3 py-2.5 text-sm"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border rounded-xl px-3 py-2.5 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">備註</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full border rounded-xl px-3 py-2.5 text-sm min-h-[60px]"
            />
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border-2 rounded-xl py-2.5 font-medium text-gray-600"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={submitting || !name.trim()}
              className="flex-1 bg-indigo-600 text-white rounded-xl py-2.5 font-bold disabled:opacity-50"
            >
              {submitting ? "儲存中…" : isEdit ? "更新" : "新增"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
