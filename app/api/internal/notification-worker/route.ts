import { NextRequest, NextResponse } from "next/server";
import { recordWorkerAuthorizationFailure } from "@/lib/alerts";
import { getRequestId, getRouteFromRequest, logWarn } from "@/lib/logger";
import { runNotificationWorker } from "@/lib/notifications/worker";
import { getNotificationWorkerAuthorizationSecret } from "@/lib/server-env";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${getNotificationWorkerAuthorizationSecret()}`;

  if (authHeader !== expected) {
    const requestId = getRequestId(request);
    await recordWorkerAuthorizationFailure(requestId);
    logWarn({
      event: "notification_worker_unauthorized",
      requestId,
      route: getRouteFromRequest(request),
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = await runNotificationWorker();
  return NextResponse.json(summary);
}
