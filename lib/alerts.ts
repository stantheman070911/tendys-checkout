import { getOpsAlertWebhookUrl, readOptionalEnv } from "@/lib/server-env";
import { logError, logWarn } from "@/lib/logger";

const workerAuthBuckets = new Map<string, number>();

function buildSlackText(args: {
  title: string;
  body: string;
  severity?: "info" | "warning" | "critical";
}) {
  const severity = args.severity ?? "warning";
  return `*${severity.toUpperCase()}* ${args.title}\n${args.body}`;
}

export async function sendOpsAlert(args: {
  title: string;
  body: string;
  severity?: "info" | "warning" | "critical";
}) {
  const webhookUrl = readOptionalEnv("OPS_ALERT_WEBHOOK_URL");

  if (!webhookUrl) {
    logWarn({
      event: "ops_alert_skipped_missing_webhook",
      details: { title: args.title },
    });
    return false;
  }

  try {
    const response = await fetch(getOpsAlertWebhookUrl()!, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: buildSlackText(args),
      }),
    });

    if (!response.ok) {
      throw new Error(`Ops alert webhook returned ${response.status}`);
    }

    return true;
  } catch (error) {
    logError({
      event: "ops_alert_failed",
      error,
      details: { title: args.title },
    });
    return false;
  }
}

export async function recordWorkerAuthorizationFailure(requestId?: string | null) {
  const now = new Date();
  const bucket = now.toISOString().slice(0, 16);

  for (const key of workerAuthBuckets.keys()) {
    if (key !== bucket) {
      workerAuthBuckets.delete(key);
    }
  }

  const count = (workerAuthBuckets.get(bucket) ?? 0) + 1;
  workerAuthBuckets.set(bucket, count);

  if (count >= 3) {
    await sendOpsAlert({
      title: "Notification worker authorization failures",
      body: `Repeated unauthorized worker requests detected. count=${count}, requestId=${requestId ?? "unknown"}`,
      severity: "critical",
    });
  }

  return count;
}
