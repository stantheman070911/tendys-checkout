import { validateOrderNumber } from "./validate-order-code";
import { sendLineMessage } from "./push";
import { prisma } from "../db/prisma";
import { STATUS_LABELS } from "@/constants";

// ─── Response strings ────────────────────────────────────────

const MSG_LINKED_SUCCESS = (orderNumber: string) =>
  `收到！訂單 ${orderNumber} 已綁定成功 ✅\n出貨時我們會在這裡通知你！`;

const MSG_ALREADY_LINKED = (orderNumber: string, status: string) =>
  `你的訂單 ${orderNumber} 已經綁定了！\n目前狀態：${STATUS_LABELS[status] ?? status}`;

const MSG_ORDER_NOT_FOUND =
  "找不到這筆訂單，請確認你貼的是完整的訂單編號（例如：ORD-20260318-001）。";

const MSG_ORDER_ALREADY_LINKED_OTHER =
  "這張訂單已經綁定其他 LINE 帳號了。如有疑問請聯絡客服。";

const MSG_UNKNOWN =
  "嗨！請把訂單編號貼給我，我幫你綁定出貨通知 📦\n（訂單編號在下單後的頁面上，格式如：ORD-20260318-001）";

const MSG_ERROR =
  "系統有點問題，等一下再試試看 🙏";

// ─── Order number pattern: ORD-YYYYMMDD-NNN ─────────────────

const ORDER_NUMBER_PATTERN = /^ORD-\d{8}-\d{3}$/i;

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
  replyToken?: string
): Promise<void> {
  const trimmed = text.trim().toUpperCase();

  // ── If message matches order number pattern, try to validate ─
  if (ORDER_NUMBER_PATTERN.test(trimmed)) {
    try {
      const result = await validateOrderNumber(trimmed, lineUserId);

      if (result.valid) {
        await sendLineMessage(
          lineUserId,
          MSG_LINKED_SUCCESS(result.orderNumber),
          replyToken
        );
        return;
      }

      const errorMessages: Record<string, string> = {
        NOT_FOUND: MSG_ORDER_NOT_FOUND,
        ALREADY_LINKED: MSG_ORDER_ALREADY_LINKED_OTHER,
      };

      await sendLineMessage(
        lineUserId,
        errorMessages[result.error] ?? MSG_ERROR,
        replyToken
      );
      return;
    } catch {
      await sendLineMessage(lineUserId, MSG_ERROR, replyToken);
      return;
    }
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
      replyToken
    );
    return;
  }

  // ── Unknown user sending arbitrary text ────────────────────
  await sendLineMessage(lineUserId, MSG_UNKNOWN, replyToken);
}
