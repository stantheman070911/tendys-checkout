import { after } from "next/server";
import { logError } from "@/lib/logger";
import { captureException } from "@/lib/observability/sentry";

type WaitUntilCapableGlobal = typeof globalThis & {
  waitUntil?: (promise: Promise<void>) => void;
};

export function fireAndForget(task: () => Promise<unknown>) {
  const runTask = () =>
    task()
      .catch(async (error) => {
        logError({
          event: "background_task_failed",
          error,
        });
        await captureException(error);
      })
      .then(() => undefined);

  try {
    after(() => runTask());
    return;
  } catch {
    const runtime = globalThis as WaitUntilCapableGlobal;
    runtime.waitUntil?.(Promise.resolve().then(() => runTask()));
  }
}
