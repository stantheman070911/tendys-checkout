import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { checkRedisHealth } from "@/lib/upstash";
import {
  getProductionRuntimeValidationErrors,
  readOptionalEnv,
} from "@/lib/server-env";

export async function GET() {
  const envErrors = getProductionRuntimeValidationErrors();
  const redisCheck = await checkRedisHealth();

  let databaseOk = true;
  let databaseError: string | null = null;

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    databaseOk = false;
    databaseError =
      error instanceof Error ? error.message : "Unknown database error";
  }

  const workerSecretConfigured = Boolean(readOptionalEnv("NOTIFICATION_WORKER_SECRET"));

  const status =
    envErrors.length === 0 && databaseOk && redisCheck.ok && workerSecretConfigured
      ? "ok"
      : databaseOk
        ? "degraded"
        : "fail";

  return NextResponse.json(
    {
      status,
      checks: {
        database: databaseOk ? "ok" : "fail",
        redis: redisCheck.ok ? "ok" : "fail",
        env: envErrors.length === 0 ? "ok" : "fail",
        notificationWorkerSecret: workerSecretConfigured ? "ok" : "fail",
      },
      errors: {
        database: databaseError,
        redis: redisCheck.error,
        envCount: envErrors.length,
      },
    },
    { status: status === "ok" ? 200 : 503 },
  );
}
