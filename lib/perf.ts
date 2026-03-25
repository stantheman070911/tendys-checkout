type PerfMeta = Record<string, string | number | boolean | null | undefined>;

function isPerfLoggingEnabled() {
  return process.env.PERF_LOGGING === "1";
}

function getPerfSlowThresholdMs() {
  const value = Number.parseInt(process.env.PERF_SLOW_THRESHOLD_MS ?? "", 10);
  if (Number.isFinite(value) && value > 0) {
    return value;
  }
  return 150;
}

export async function measureAsync<T>(
  name: string,
  fn: () => Promise<T>,
  meta?: PerfMeta,
): Promise<T> {
  const startedAt = Date.now();

  try {
    return await fn();
  } finally {
    if (isPerfLoggingEnabled()) {
      const durationMs = Date.now() - startedAt;
      if (durationMs >= getPerfSlowThresholdMs()) {
        console.info("[perf]", name, {
          durationMs,
          ...(meta ?? {}),
        });
      }
    }
  }
}
