import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type {
  NotificationChannel,
  NotificationJobStatus,
  NotificationType,
} from "@/types";

export interface CreateNotificationJobInput {
  orderId?: string | null;
  roundId?: string | null;
  productId?: string | null;
  recipient: string;
  channel: NotificationChannel;
  type: NotificationType;
  payload: Prisma.InputJsonValue;
  dedupeKey: string;
  maxAttempts?: number;
  availableAt?: Date;
}

type NotificationJobRow = {
  id: string;
  order_id: string | null;
  round_id: string | null;
  product_id: string | null;
  recipient: string;
  channel: string;
  type: string;
  payload: Prisma.JsonValue;
  dedupe_key: string;
  status: string;
  attempt_count: number;
  max_attempts: number;
  available_at: Date;
  locked_at: Date | null;
  last_error: string | null;
  created_at: Date;
  updated_at: Date;
  sent_at: Date | null;
};

export interface ClaimedNotificationJob
  extends Omit<NotificationJobRow, "channel" | "type" | "status"> {
  channel: NotificationChannel;
  type: NotificationType;
  status: NotificationJobStatus;
}

async function createJobsInternal(
  client: Prisma.TransactionClient | typeof prisma,
  jobs: CreateNotificationJobInput[],
) {
  if (jobs.length === 0) {
    return { count: 0 };
  }

  return client.notificationJob.createMany({
    data: jobs.map((job) => ({
      order_id: job.orderId ?? null,
      round_id: job.roundId ?? null,
      product_id: job.productId ?? null,
      recipient: job.recipient,
      channel: job.channel,
      type: job.type,
      payload: job.payload,
      dedupe_key: job.dedupeKey,
      status: "pending",
      attempt_count: 0,
      max_attempts: job.maxAttempts ?? 3,
      available_at: job.availableAt ?? new Date(),
      locked_at: null,
      last_error: null,
      sent_at: null,
    })),
    skipDuplicates: true,
  });
}

export async function createNotificationJobsTx(
  tx: Prisma.TransactionClient,
  jobs: CreateNotificationJobInput[],
) {
  return createJobsInternal(tx, jobs);
}

export async function createNotificationJobs(jobs: CreateNotificationJobInput[]) {
  return createJobsInternal(prisma, jobs);
}

export async function claimNotificationJobs(limit = 25) {
  const rows = await prisma.$queryRaw<NotificationJobRow[]>(Prisma.sql`
    WITH candidates AS (
      SELECT id
      FROM public.notification_jobs
      WHERE
        available_at <= now()
        AND (
          status = 'pending'
          OR (
            status = 'processing'
            AND locked_at < now() - interval '10 minutes'
          )
        )
      ORDER BY available_at ASC, created_at ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    UPDATE public.notification_jobs AS jobs
    SET
      status = 'processing',
      locked_at = now(),
      updated_at = now()
    FROM candidates
    WHERE jobs.id = candidates.id
    RETURNING
      jobs.id,
      jobs.order_id,
      jobs.round_id,
      jobs.product_id,
      jobs.recipient,
      jobs.channel,
      jobs.type,
      jobs.payload,
      jobs.dedupe_key,
      jobs.status,
      jobs.attempt_count,
      jobs.max_attempts,
      jobs.available_at,
      jobs.locked_at,
      jobs.last_error,
      jobs.created_at,
      jobs.updated_at,
      jobs.sent_at
  `);

  return rows as ClaimedNotificationJob[];
}

export async function markNotificationJobSent(jobId: string, attemptCount: number) {
  return prisma.notificationJob.update({
    where: { id: jobId },
    data: {
      status: "sent",
      attempt_count: attemptCount,
      locked_at: null,
      last_error: null,
      sent_at: new Date(),
    },
  });
}

export async function markNotificationJobFailed(
  jobId: string,
  attemptCount: number,
  lastError: string,
) {
  return prisma.notificationJob.update({
    where: { id: jobId },
    data: {
      status: "failed",
      attempt_count: attemptCount,
      locked_at: null,
      last_error: lastError,
    },
  });
}

export async function requeueNotificationJobs(input: {
  jobIds?: string[];
  roundId?: string;
}) {
  const where: Prisma.NotificationJobWhereInput = {
    status: "failed",
    ...(input.jobIds?.length
      ? { id: { in: input.jobIds } }
      : input.roundId
        ? { round_id: input.roundId }
        : {}),
  };

  return prisma.notificationJob.updateMany({
    where,
    data: {
      status: "pending",
      attempt_count: 0,
      locked_at: null,
      last_error: null,
      available_at: new Date(),
    },
  });
}

export async function listFailedNotificationJobsByRound(
  roundId: string,
  limit = 20,
) {
  return prisma.notificationJob.findMany({
    where: {
      round_id: roundId,
      status: "failed",
    },
    orderBy: { created_at: "desc" },
    take: limit,
  });
}
