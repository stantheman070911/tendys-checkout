type WaitUntilCapableGlobal = typeof globalThis & {
  waitUntil?: (promise: Promise<unknown>) => void;
};

export function fireAndForget(task: () => Promise<unknown>) {
  const promise = task().catch((error) => {
    console.error("Background notification task failed", error);
  });

  const runtime = globalThis as WaitUntilCapableGlobal;
  runtime.waitUntil?.(promise);
}
