// Handles incoming LINE text messages for the order notification bot.
//
// Flow:
//   1. User sends a message to the LINE Official Account.
//   2. If the message looks like an 8-char code → try to validate it.
//   3. On success → confirm linkage, they'll now receive order notifications.
//   4. On failure → give specific feedback.
//   5. If user is already linked → respond with order status.

import { validateOrderCode } from "../auth/validate-order-code";
import { getOrderByLineId } from "../db/order";
import { sendLineMessage } from "./reply"; // reuse same push/reply helper

// ─────────────────────────────────────────────────────────────────────────────
// Response strings
// ─────────────────────────────────────────────────────────────────────────────

const MSG_LINKED_SUCCESS = (name: string) =>
  `收到！${name} 的訂單已綁定成功 ✅\n出貨時我們會在這裡通知你，不用一直來催 😄`;

const MSG_ALREADY_LINKED = (status: string) =>
  `你的訂單已經綁定了！\n目前狀態：${STATUS_LABELS[status] ?? status}`;

const MSG_CODE_NOT_FOUND =
  `找不到這組序號，請確認你貼的是完整的8碼序號（例如：A3KX9P2M）。`;

const MSG_CODE_USED =
  `這組序號已經用過了。如果有問題請聯絡客服。`;

const MSG_CODE_EXPIRED =
  `序號已過期，請重新下訂單取得新序號。`;

const MSG_CODE_ALREADY_LINKED_OTHER =
  `這張訂單已經綁定其他 LINE 帳號了。如有疑問請聯絡客服。`;

const MSG_UNKNOWN =
  `嗨！請把訂單序號貼給我，我幫你綁定出貨通知 📦\n（序號在下訂後的頁面上，共8碼）`;

const MSG_ERROR =
  `系統有點問題，等一下再試試看 🙏`;

const STATUS_LABELS: Record<string, string> = {
  PENDING:   "等待綁定",
  LINKED:    "已綁定，備貨中",
  SHIPPED:   "已出貨",
  DELIVERED: "已送達",
};

// ─────────────────────────────────────────────────────────────────────────────
// Code pattern: exactly 8 uppercase alphanumeric chars (same alphabet as generate-code.ts)
// ─────────────────────────────────────────────────────────────────────────────

const CODE_PATTERN = /^[A-HJ-NP-Z2-9]{8}$/i;

// ─────────────────────────────────────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────────────────────────────────────

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

  // ── If user is already linked, show their order status ───────────────────
  // (they may just be checking in, or accidentally messaging again)
  const existingOrder = await getOrderByLineId(lineUserId);
  if (existingOrder) {
    await sendLineMessage(
      lineUserId,
      MSG_ALREADY_LINKED(existingOrder.status),
      replyToken
    );
    return;
  }

  // ── Try to validate as a code if it matches the pattern ──────────────────
  if (CODE_PATTERN.test(trimmed)) {
    try {
      const result = await validateOrderCode(trimmed, lineUserId);

      if (result.valid) {
        await sendLineMessage(
          lineUserId,
          MSG_LINKED_SUCCESS(result.orderName),
          replyToken
        );
        return;
      }

      const errorMessages: Record<string, string> = {
        NOT_FOUND:      MSG_CODE_NOT_FOUND,
        USED:           MSG_CODE_USED,
        EXPIRED:        MSG_CODE_EXPIRED,
        ALREADY_LINKED: MSG_CODE_ALREADY_LINKED_OTHER,
      };

      await sendLineMessage(
        lineUserId,
        errorMessages[result.error] ?? MSG_ERROR,
        replyToken
      );
      return;
    } catch (err) {
      console.error("[handleMessage] validateOrderCode error:", err);
      await sendLineMessage(lineUserId, MSG_ERROR, replyToken);
      return;
    }
  }

  // ── Unknown user sending arbitrary text ──────────────────────────────────
  await sendLineMessage(lineUserId, MSG_UNKNOWN, replyToken);
}
