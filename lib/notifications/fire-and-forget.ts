import { after } from "next/server";

type WaitUntilCapableGlobal = typeof globalThis & {
  waitUntil?: (promise: Promise<void>) => void;
};

export function fireAndForget(task: () => Promise<unknown>) {
  const promise = task()
    .catch((error) => {
      console.error("Background notification task failed", error);
    })
    .then(() => undefined);

  try {
    after(promise);
    return;
  } catch {
    const runtime = globalThis as WaitUntilCapableGlobal;
    runtime.waitUntil?.(promise);
  }
}
