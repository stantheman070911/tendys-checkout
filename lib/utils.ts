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

export function calcOrderTotal(
  items: Array<{ subtotal: number }>,
  shippingFee?: number | null,
): number {
  const itemsTotal = items.reduce((sum, i) => sum + i.subtotal, 0);
  return itemsTotal + (shippingFee ?? 0);
}
