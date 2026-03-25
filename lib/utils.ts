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

export const PUBLIC_CHECKOUT_AUTOFILL_MIN_PHONE_DIGITS = 10;

export function normalizePhoneDigits(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

export function getPhoneLast3(phone: string | null | undefined): string {
  const digits = normalizePhoneDigits(phone);
  return digits.length >= 3 ? digits.slice(-3) : "";
}

export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  const digits = normalizePhoneDigits(phone);
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
