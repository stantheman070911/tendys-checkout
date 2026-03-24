import type { NotificationLog, NotificationType } from "@/types";

export interface NotificationChannelSummary {
  success: number;
  failed: number;
  skipped: number;
}

export interface NotificationTypeSummary {
  type: NotificationType;
  line: NotificationChannelSummary;
  email: NotificationChannelSummary;
}

function createChannelSummary(): NotificationChannelSummary {
  return { success: 0, failed: 0, skipped: 0 };
}

export function summarizeNotificationLogs(
  logs: NotificationLog[],
): NotificationTypeSummary[] {
  const summaryByType = new Map<NotificationType, NotificationTypeSummary>();

  for (const log of logs) {
    if (!summaryByType.has(log.type)) {
      summaryByType.set(log.type, {
        type: log.type,
        line: createChannelSummary(),
        email: createChannelSummary(),
      });
    }

    const summary = summaryByType.get(log.type);
    if (!summary) continue;

    const channelSummary = summary[log.channel];
    channelSummary[log.status]++;
  }

  return Array.from(summaryByType.values());
}
