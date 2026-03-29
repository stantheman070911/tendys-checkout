import { sendOpsAlert } from "@/lib/alerts";
import { logError } from "@/lib/logger";
import { validateProductionRuntimeConfig } from "@/lib/server-env";

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  try {
    validateProductionRuntimeConfig();
  } catch (error) {
    logError({
      event: "boot_configuration_validation_failed",
      route: "app/instrumentation.ts",
      error,
    });
    await sendOpsAlert({
      title: "Runtime configuration validation failed",
      body: error instanceof Error ? error.message : "Unknown boot validation error",
      severity: "critical",
    });
    throw error;
  }

  const Sentry = await import("@sentry/nextjs");
  Sentry.init({
    dsn: process.env.SENTRY_DSN ?? undefined,
    tracesSampleRate: 0,
  });
}
