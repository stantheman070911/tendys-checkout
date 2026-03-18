export type NotifyResult = { success: boolean; error?: string };

const LINE_API_BASE = "https://api.line.me/v2/bot/message";

function getToken(): string | null {
  return process.env.LINE_CHANNEL_ACCESS_TOKEN ?? null;
}

async function linePost(
  endpoint: string,
  body: Record<string, unknown>
): Promise<NotifyResult> {
  try {
    const token = getToken();
    if (!token) {
      return { success: false, error: "LINE_CHANNEL_ACCESS_TOKEN not configured" };
    }

    const res = await fetch(`${LINE_API_BASE}/${endpoint}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      return { success: false, error: `LINE API ${res.status}: ${text}` };
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Send a push message to a single LINE user.
 * POST /v2/bot/message/push
 */
export async function sendLinePush(
  lineUserId: string,
  message: string
): Promise<NotifyResult> {
  return linePost("push", {
    to: lineUserId,
    messages: [{ type: "text", text: message }],
  });
}

/**
 * Send a multicast message to up to 500 LINE users.
 * POST /v2/bot/message/multicast
 */
export async function sendLineMulticast(
  lineUserIds: string[],
  message: string
): Promise<NotifyResult> {
  if (lineUserIds.length === 0) {
    return { success: true };
  }
  if (lineUserIds.length === 1) {
    return sendLinePush(lineUserIds[0], message);
  }
  // Multicast supports up to 500 recipients per call
  if (lineUserIds.length > 500) {
    // Chunk into batches of 500
    const results: NotifyResult[] = [];
    for (let i = 0; i < lineUserIds.length; i += 500) {
      const chunk = lineUserIds.slice(i, i + 500);
      results.push(
        await linePost("multicast", {
          to: chunk,
          messages: [{ type: "text", text: message }],
        })
      );
    }
    const failed = results.filter((r) => !r.success);
    if (failed.length > 0) {
      return { success: false, error: failed.map((f) => f.error).join("; ") };
    }
    return { success: true };
  }
  return linePost("multicast", {
    to: lineUserIds,
    messages: [{ type: "text", text: message }],
  });
}

/**
 * Reply to a LINE message using a reply token (free, but token expires quickly).
 * POST /v2/bot/message/reply
 */
export async function sendLineReply(
  replyToken: string,
  message: string
): Promise<NotifyResult> {
  return linePost("reply", {
    replyToken,
    messages: [{ type: "text", text: message }],
  });
}

/**
 * Send a LINE message: tries reply first (free), falls back to push.
 * Used by the webhook message handler.
 */
export async function sendLineMessage(
  lineUserId: string,
  text: string,
  replyToken?: string
): Promise<NotifyResult> {
  if (replyToken) {
    const replyResult = await sendLineReply(replyToken, text);
    if (replyResult.success) return replyResult;
    // Reply token may have expired — fall back to push
  }
  return sendLinePush(lineUserId, text);
}
