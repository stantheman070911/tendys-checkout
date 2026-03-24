import { Resend } from "resend";
import type { NotifyResult } from "@/lib/line/push";

export type { NotifyResult };

let resendClient: Resend | null = null;

function getResend(): Resend | null {
  if (resendClient) return resendClient;
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  resendClient = new Resend(key);
  return resendClient;
}

function getFrom(): string {
  return process.env.RESEND_FROM_EMAIL ?? "noreply@example.com";
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── Payment Confirmed Email ─────────────────────────────────

export async function sendOrderConfirmationEmail(
  to: string,
  order: {
    order_number: string;
    total_amount: number;
    shipping_fee?: number | null;
  },
  items: Array<{ product_name: string; quantity: number; subtotal: number }>,
): Promise<NotifyResult> {
  try {
    const resend = getResend();
    if (!resend) {
      return { success: false, error: "RESEND_API_KEY not configured" };
    }

    const itemRows = items
      .map(
        (i) =>
          `<tr><td style="padding:4px 8px">${escapeHtml(i.product_name)}</td><td style="padding:4px 8px">${i.quantity}</td><td style="padding:4px 8px">$${i.subtotal}</td></tr>`,
      )
      .join("");

    const shippingRow = order.shipping_fee
      ? `<tr><td style="padding:4px 8px" colspan="2">運費</td><td style="padding:4px 8px">$${order.shipping_fee}</td></tr>`
      : "";

    const html = `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2>訂單付款已確認</h2>
        <p>訂單編號：<strong>${escapeHtml(order.order_number)}</strong></p>
        <table style="width:100%;border-collapse:collapse">
          <thead><tr style="border-bottom:1px solid #ddd">
            <th style="padding:4px 8px;text-align:left">品項</th>
            <th style="padding:4px 8px;text-align:left">數量</th>
            <th style="padding:4px 8px;text-align:left">小計</th>
          </tr></thead>
          <tbody>${itemRows}${shippingRow}</tbody>
          <tfoot><tr style="border-top:1px solid #ddd;font-weight:bold">
            <td style="padding:4px 8px" colspan="2">合計</td>
            <td style="padding:4px 8px">$${order.total_amount}</td>
          </tr></tfoot>
        </table>
        <p style="margin-top:16px">我們會盡快安排出貨，感謝您的訂購！</p>
      </div>
    `;

    await resend.emails.send({
      from: getFrom(),
      to,
      subject: `訂單 ${order.order_number} 付款已確認`,
      html,
    });

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

// ─── Shipment Email ──────────────────────────────────────────

export async function sendShipmentEmail(
  to: string,
  order: { order_number: string },
  items: Array<{ product_name: string; quantity: number }>,
): Promise<NotifyResult> {
  try {
    const resend = getResend();
    if (!resend) {
      return { success: false, error: "RESEND_API_KEY not configured" };
    }

    const itemList = items
      .map((i) => `<li>${escapeHtml(i.product_name)} x ${i.quantity}</li>`)
      .join("");

    const html = `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2>出貨通知</h2>
        <p>訂單編號：<strong>${escapeHtml(order.order_number)}</strong></p>
        <p>您的訂單已出貨 / 已備妥可取貨：</p>
        <ul>${itemList}</ul>
        <p>感謝您的訂購！</p>
      </div>
    `;

    await resend.emails.send({
      from: getFrom(),
      to,
      subject: `訂單 ${order.order_number} 已出貨`,
      html,
    });

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

// ─── Order Cancelled Email ────────────────────────────────────

export async function sendOrderCancelledEmail(
  to: string,
  order: {
    order_number: string;
    total_amount: number;
    shipping_fee?: number | null;
  },
  items: Array<{ product_name: string; quantity: number; subtotal: number }>,
  cancelReason?: string | null,
): Promise<NotifyResult> {
  try {
    const resend = getResend();
    if (!resend) {
      return { success: false, error: "RESEND_API_KEY not configured" };
    }

    const itemRows = items
      .map(
        (i) =>
          `<tr><td style="padding:4px 8px">${escapeHtml(i.product_name)}</td><td style="padding:4px 8px">${i.quantity}</td><td style="padding:4px 8px">$${i.subtotal}</td></tr>`,
      )
      .join("");

    const shippingRow = order.shipping_fee
      ? `<tr><td style="padding:4px 8px" colspan="2">運費</td><td style="padding:4px 8px">$${order.shipping_fee}</td></tr>`
      : "";

    const reasonBlock = cancelReason
      ? `<p><strong>取消原因：</strong>${escapeHtml(cancelReason)}</p>`
      : "";

    const html = `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2>訂單取消通知</h2>
        <p>訂單編號：<strong>${escapeHtml(order.order_number)}</strong></p>
        <p>您的訂單已被取消。</p>
        ${reasonBlock}
        <table style="width:100%;border-collapse:collapse">
          <thead><tr style="border-bottom:1px solid #ddd">
            <th style="padding:4px 8px;text-align:left">品項</th>
            <th style="padding:4px 8px;text-align:left">數量</th>
            <th style="padding:4px 8px;text-align:left">小計</th>
          </tr></thead>
          <tbody>${itemRows}${shippingRow}</tbody>
          <tfoot><tr style="border-top:1px solid #ddd;font-weight:bold">
            <td style="padding:4px 8px" colspan="2">合計</td>
            <td style="padding:4px 8px">$${order.total_amount}</td>
          </tr></tfoot>
        </table>
        <p style="margin-top:16px">如有疑問，請聯繫團主。</p>
      </div>
    `;

    await resend.emails.send({
      from: getFrom(),
      to,
      subject: `訂單取消通知 — ${order.order_number}`,
      html,
    });

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

// ─── Product Arrival Email ───────────────────────────────────

export async function sendProductArrivalEmail(
  to: string,
  productName: string,
): Promise<NotifyResult> {
  try {
    const resend = getResend();
    if (!resend) {
      return { success: false, error: "RESEND_API_KEY not configured" };
    }

    const html = `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2>商品到貨通知</h2>
        <p>您訂購的【<strong>${escapeHtml(productName)}</strong>】已到達理貨中心，我們會盡快安排出貨！</p>
      </div>
    `;

    await resend.emails.send({
      from: getFrom(),
      to,
      subject: `${productName} 已到達理貨中心`,
      html,
    });

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
