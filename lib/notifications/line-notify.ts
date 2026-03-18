export type NotifyResult = { success: boolean; error?: string };

/**
 * Send a LINE message via LINE Messaging API (broadcast to all followers).
 * Replaces the deprecated LINE Notify.
 * Uses LINE_CHANNEL_ACCESS_TOKEN env var.
 */
export async function sendLineNotify(message: string): Promise<NotifyResult> {
  try {
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (!token) {
      return { success: false, error: "LINE_CHANNEL_ACCESS_TOKEN not configured" };
    }

    const res = await fetch("https://api.line.me/v2/bot/message/broadcast", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [{ type: "text", text: message }],
      }),
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
