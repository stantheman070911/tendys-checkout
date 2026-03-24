import { validateOrderNumber } from "./validate-order-code";
import { extractOrderNumber } from "./extract-order-number";
import { sendLineMessage } from "./push";
import { prisma } from "../db/prisma";
import { STATUS_LABELS } from "@/constants";
import type { OrderStatus } from "@/types";

// ─── Response strings ────────────────────────────────────────

const MSG_LINKED_SUCCESS = (orderNumber: string) =>
  `收到！訂單 ${orderNumber} 已綁定成功 ✅\n出貨時我們會在這裡通知你！`;

const MSG_ALREADY_LINKED = (orderNumber: string, status: string) =>
  `你的訂單 ${orderNumber} 已經綁定了！\n目前狀態：${STATUS_LABELS[status as OrderStatus] ?? status}`;

const MSG_LINK_FAILED =
  "綁定失敗，請確認你傳送的是完整的訂單編號和 12 碼查詢碼。";

const MSG_BIND_INSTRUCTION =
  "請傳送「訂單編號 + 查詢碼」來綁定通知，例如：ORD-20260318-001 ABCD1234EFGH";

const MSG_UNKNOWN =
  "嗨！請把訂單編號和查詢碼貼給我，我幫你綁定出貨通知 📦\n（格式如：ORD-20260318-001 ABCD1234EFGH）";

const MSG_ERROR = "系統有點問題，等一下再試試看 🙏";

// ─── Handler ─────────────────────────────────────────────────

/**
 * Handle an incoming LINE text message.
 *
 * @param lineUserId  LINE user ID from the webhook event
 * @param text        Message text
 * @param replyToken  LINE reply token (short-lived; falls back to push if expired)
 */
export async function handleMessage(
  lineUserId: string,
  text: string,
  replyToken?: string,
): Promise<void> {
  const orderNumber = extractOrderNumber(text);
  const accessCode =
    text
      .trim()
      .toUpperCase()
      .match(/\b[A-Z0-9]{12}\b/)?.[0] ?? null;

  // ── If message matches order number pattern, try to validate ─
  if (orderNumber && accessCode) {
    try {
      const result = await validateOrderNumber(
        orderNumber,
        accessCode,
        lineUserId,
      );

      if (result.valid) {
        const replyText = result.alreadyLinked
          ? MSG_ALREADY_LINKED(result.orderNumber, result.status)
          : MSG_LINKED_SUCCESS(result.orderNumber);
        await sendLineMessage(lineUserId, replyText, replyToken);
        return;
      }

      await sendLineMessage(lineUserId, MSG_LINK_FAILED, replyToken);
      return;
    } catch {
      await sendLineMessage(lineUserId, MSG_ERROR, replyToken);
      return;
    }
  }

  if (orderNumber) {
    await sendLineMessage(lineUserId, MSG_BIND_INSTRUCTION, replyToken);
    return;
  }

  // ── Check if user has any linked orders ────────────────────
  const existingOrder = await prisma.order.findFirst({
    where: { line_user_id: lineUserId },
    orderBy: { created_at: "desc" },
  });
  if (existingOrder) {
    await sendLineMessage(
      lineUserId,
      MSG_ALREADY_LINKED(existingOrder.order_number, existingOrder.status),
      replyToken,
    );
    return;
  }

  // ── Unknown user sending arbitrary text ────────────────────
  await sendLineMessage(lineUserId, MSG_UNKNOWN, replyToken);
}
