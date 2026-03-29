import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/auth/supabase-admin";
import { requeueNotificationJobs } from "@/lib/db/notification-jobs";
import {
  parseJsonBody,
  optionalUuidStringSchema,
  uuidStringSchema,
  z,
} from "@/lib/validation";

const retryNotificationJobsSchema = z
  .object({
    jobIds: z.array(uuidStringSchema("jobId")).optional(),
    roundId: optionalUuidStringSchema("roundId"),
  })
  .superRefine((value, context) => {
    if ((!value.jobIds || value.jobIds.length === 0) && !value.roundId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide jobIds or roundId",
      });
    }
  });

export async function POST(request: NextRequest) {
  const isAdmin = await verifyAdminSession(request);
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsedBody = await parseJsonBody(request, retryNotificationJobsSchema);
  if (!parsedBody.success) {
    return parsedBody.response;
  }

  const result = await requeueNotificationJobs({
    jobIds: parsedBody.data.jobIds,
    roundId: parsedBody.data.roundId,
  });

  return NextResponse.json({ requeued: result.count });
}
