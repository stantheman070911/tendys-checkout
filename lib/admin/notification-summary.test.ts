import { describe, expect, it } from "vitest";
import { summarizeNotificationLogs } from "./notification-summary";
import type { NotificationLog } from "@/types";

describe("summarizeNotificationLogs", () => {
  it("counts success, failed, and skipped per type and channel", () => {
    const logs: NotificationLog[] = [
      {
        id: "1",
        order_id: "o1",
        round_id: "r1",
        product_id: null,
        channel: "line",
        type: "payment_confirmed",
        status: "success",
        error_message: null,
        created_at: "2026-03-22T00:00:00.000Z",
      },
      {
        id: "2",
        order_id: "o1",
        round_id: "r1",
        product_id: null,
        channel: "line",
        type: "payment_confirmed",
        status: "skipped",
        error_message: null,
        created_at: "2026-03-22T00:00:00.000Z",
      },
      {
        id: "3",
        order_id: "o1",
        round_id: "r1",
        product_id: null,
        channel: "email",
        type: "payment_confirmed",
        status: "failed",
        error_message: "bounce",
        created_at: "2026-03-22T00:00:00.000Z",
      },
    ];

    expect(summarizeNotificationLogs(logs)).toEqual([
      {
        type: "payment_confirmed",
        line: { success: 1, failed: 0, skipped: 1 },
        email: { success: 0, failed: 1, skipped: 0 },
      },
    ]);
  });
});
