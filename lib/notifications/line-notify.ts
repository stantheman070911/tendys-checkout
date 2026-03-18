export type NotifyResult = { success: boolean; error?: string };

export async function sendLineNotify(message: string): Promise<NotifyResult> {
  try {
    const token = process.env.LINE_NOTIFY_TOKEN;
    if (!token) {
      return { success: false, error: "LINE_NOTIFY_TOKEN not configured" };
    }

    const res = await fetch("https://notify-api.line.me/api/notify", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ message }),
    });

    if (!res.ok) {
      const text = await res.text();
      return { success: false, error: `LINE Notify ${res.status}: ${text}` };
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
