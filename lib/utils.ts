import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─── Currency & Formatting ───────────────────────────────────

export function formatCurrency(amount: number): string {
  return `$${amount}`;
}

export function formatOrderItems(
  items: Array<{ product_name: string; quantity: number }>,
): string {
  return items.map((i) => `${i.product_name}x${i.quantity}`).join("、");
}

// ─── Share URLs ──────────────────────────────────────────────

export function buildShareUrl(roundId: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "";
  return `${base}?round=${roundId}`;
}

export function buildLineShareUrl(url: string, text: string): string {
  return `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
}

// ─── Order Helpers ───────────────────────────────────────────

export function generateSubmissionKey(): string {
  return crypto.randomUUID();
}

export function generateAccessCode(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase();
}

export function normalizeAccessCode(value: string): string {
  return value.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return phone;
  return `***-***-${digits.slice(-4)}`;
}

export function calcOrderTotal(
  items: Array<{ subtotal: number }>,
  shippingFee?: number | null,
): number {
  const itemsTotal = items.reduce((sum, i) => sum + i.subtotal, 0);
  return itemsTotal + (shippingFee ?? 0);
}
