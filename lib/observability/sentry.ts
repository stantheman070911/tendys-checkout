export async function captureException(
  error: unknown,
  context?: Record<string, unknown>,
) {
  try {
    const Sentry = await import("@sentry/nextjs");
    Sentry.captureException(error, {
      extra: context,
    });
  } catch {
    // Avoid masking the original failure if Sentry is unavailable.
  }
}
