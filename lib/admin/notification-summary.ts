import type { NotificationLog, NotificationType } from "@/types";
import type {
  NotificationChannel,
  NotificationLogStatus,
} from "@/types";

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

export interface NotificationSummaryCount {
  type: NotificationType;
  channel: NotificationChannel;
  status: NotificationLogStatus;
  count: number;
}

export function summarizeNotificationCounts(
  counts: NotificationSummaryCount[],
): NotificationTypeSummary[] {
  const summaryByType = new Map<NotificationType, NotificationTypeSummary>();

  for (const entry of counts) {
    if (!summaryByType.has(entry.type)) {
      summaryByType.set(entry.type, {
        type: entry.type,
        line: createChannelSummary(),
        email: createChannelSummary(),
      });
    }

    const summary = summaryByType.get(entry.type);
    if (!summary) continue;

    const channelSummary = summary[entry.channel];
    channelSummary[entry.status] += entry.count;
  }

  return Array.from(summaryByType.values());
}

export function summarizeNotificationLogs(
  logs: NotificationLog[],
): NotificationTypeSummary[] {
  return summarizeNotificationCounts(
    logs.map((log) => ({
      type: log.type,
      channel: log.channel,
      status: log.status,
      count: 1,
    })),
  );
}
