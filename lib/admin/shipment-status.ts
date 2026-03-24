/**
 * Maps API notification results to tri-state UI status for shipment feedback.
 *
 * Notification contract (from lib/notifications/send.ts):
 * - LINE skip: { success: false, error: "No LINE user linked" }
 * - Email skip: null (no email on user)
 * - Success/failure: { success: boolean, error?: string }
 */

export type NotifyStatus = "success" | "failed" | "skipped";

export interface ShipmentNotifyResult {
  line: NotifyStatus;
  email: NotifyStatus;
}

export interface NotificationPayload {
  line?: { success: boolean; error?: string };
  email?: { success: boolean; error?: string } | null;
}

export function mapNotifyStatus(
  notifications: NotificationPayload | undefined,
): ShipmentNotifyResult {
  const line: NotifyStatus = !notifications?.line
    ? "skipped"
    : notifications.line.success
      ? "success"
      : notifications.line.error === "No LINE user linked"
        ? "skipped"
        : "failed";
  const email: NotifyStatus = !notifications?.email
    ? "skipped"
    : notifications.email.success
      ? "success"
      : "failed";
  return { line, email };
}

export function renderNotifyIcon(status: NotifyStatus): string {
  if (status === "success") return "✓";
  if (status === "skipped") return "—";
  return "✗";
}
