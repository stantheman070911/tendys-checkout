import { mapWithConcurrency } from "@/lib/async";
import {
  claimNotificationJobs,
  markNotificationJobFailed,
  markNotificationJobSent,
} from "@/lib/db/notification-jobs";
import { logNotification } from "@/lib/db/notification-logs";
import { logError, logInfo } from "@/lib/logger";
import { deliverNotificationJob } from "@/lib/notifications/delivery";
import { captureException } from "@/lib/observability/sentry";
import { sendOpsAlert } from "@/lib/alerts";

const RETRY_DELAYS_MS = [0, 1000, 3000] as const;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processJob(job: Awaited<ReturnType<typeof claimNotificationJobs>>[number]) {
  const maxAttempts = Math.max(1, Math.min(job.max_attempts, RETRY_DELAYS_MS.length));
  let lastError = "Unknown notification error";

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const delay = RETRY_DELAYS_MS[attempt] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
    if (delay > 0) {
      await sleep(delay);
    }

    const result = await deliverNotificationJob(job);
    if (result.success) {
      await logNotification({
        orderId: job.order_id,
        roundId: job.round_id,
        productId: job.product_id,
        channel: job.channel,
        type: job.type,
        status: "success",
      });
      await markNotificationJobSent(job.id, attempt + 1);
      return { status: "sent" as const, attempts: attempt + 1 };
    }

    lastError = result.error ?? lastError;
  }

  await logNotification({
    orderId: job.order_id,
    roundId: job.round_id,
    productId: job.product_id,
    channel: job.channel,
    type: job.type,
    status: "failed",
    errorMessage: lastError,
  });
  await markNotificationJobFailed(job.id, maxAttempts, lastError);
  await captureException(new Error(lastError), {
    jobId: job.id,
    orderId: job.order_id,
    roundId: job.round_id,
    productId: job.product_id,
    channel: job.channel,
    type: job.type,
  });
  await sendOpsAlert({
    title: "Notification delivery failed",
    body: `jobId=${job.id} type=${job.type} channel=${job.channel} recipient=${job.recipient} error=${lastError}`,
    severity: "critical",
  });
  return { status: "failed" as const, attempts: maxAttempts, error: lastError };
}

export async function runNotificationWorker() {
  const jobs = await claimNotificationJobs(25);

  if (jobs.length === 0) {
    return {
      claimed: 0,
      sent: 0,
      failed: 0,
    };
  }

  const results = await mapWithConcurrency(jobs, 5, processJob);
  const summary = results.reduce(
    (acc, result) => {
      acc[result.status] += 1;
      return acc;
    },
    { sent: 0, failed: 0 },
  );

  logInfo({
    event: "notification_worker_completed",
    details: {
      claimed: jobs.length,
      sent: summary.sent,
      failed: summary.failed,
    },
  });

  return {
    claimed: jobs.length,
    sent: summary.sent,
    failed: summary.failed,
  };
}
