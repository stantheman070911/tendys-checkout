export class EnvironmentConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnvironmentConfigurationError";
  }
}

const PRODUCTION_REQUIRED_ENV_NAMES = [
  "ADMIN_SESSION_SECRET",
  "PUBLIC_ORDER_ACCESS_SECRET",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
  "LINE_CHANNEL_ACCESS_TOKEN",
  "LINE_CHANNEL_SECRET",
  "NOTIFICATION_WORKER_SECRET",
  "CRON_SECRET",
  "SENTRY_DSN",
  "OPS_ALERT_WEBHOOK_URL",
] as const;

const warnedFallbacks = new Set<string>();
let productionRuntimeValidated = false;

function warnInsecureFallback(message: string) {
  if (warnedFallbacks.has(message)) {
    return;
  }

  warnedFallbacks.add(message);
  console.warn(message);
}

export function isProductionEnvironment() {
  return process.env.NODE_ENV === "production";
}

export function readOptionalEnv(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

export function readRequiredProductionEnv(name: string) {
  const value = readOptionalEnv(name);
  if (value) {
    return value;
  }

  throw new EnvironmentConfigurationError(
    `Missing required environment variable: ${name}`,
  );
}

function readSeparatedSigningSecret(args: {
  name: string;
  developmentFallback: string;
}) {
  const configured = readOptionalEnv(args.name);
  if (configured) {
    return configured;
  }

  if (isProductionEnvironment()) {
    throw new EnvironmentConfigurationError(
      `Missing required environment variable: ${args.name}`,
    );
  }

  warnInsecureFallback(
    `[config] ${args.name} is not set; using an insecure development fallback secret because NODE_ENV=${process.env.NODE_ENV ?? "undefined"}.`,
  );
  return args.developmentFallback;
}

export function getAdminSessionSecret() {
  return readSeparatedSigningSecret({
    name: "ADMIN_SESSION_SECRET",
    developmentFallback: "dev-only-admin-session-secret",
  });
}

export function getPublicOrderAccessSecret() {
  return readSeparatedSigningSecret({
    name: "PUBLIC_ORDER_ACCESS_SECRET",
    developmentFallback: "dev-only-public-order-secret",
  });
}

export function getNotificationWorkerSecret() {
  return readSeparatedSigningSecret({
    name: "NOTIFICATION_WORKER_SECRET",
    developmentFallback: "dev-only-notification-worker-secret",
  });
}

export function getCronSecret() {
  if (!isProductionEnvironment()) {
    return readOptionalEnv("CRON_SECRET");
  }

  return readRequiredProductionEnv("CRON_SECRET");
}

export function getNotificationWorkerAuthorizationSecret() {
  return getCronSecret() ?? getNotificationWorkerSecret();
}

export function allowBearerAdminSessionFallback() {
  return readOptionalEnv("ALLOW_BEARER_ADMIN_SESSION_FALLBACK") === "true";
}

export function getResendApiKey() {
  if (!isProductionEnvironment()) {
    return readOptionalEnv("RESEND_API_KEY");
  }

  return readRequiredProductionEnv("RESEND_API_KEY");
}

export function getResendFromEmail() {
  if (!isProductionEnvironment()) {
    return readOptionalEnv("RESEND_FROM_EMAIL");
  }

  return readRequiredProductionEnv("RESEND_FROM_EMAIL");
}

export function getLineChannelAccessToken() {
  if (!isProductionEnvironment()) {
    return readOptionalEnv("LINE_CHANNEL_ACCESS_TOKEN");
  }

  return readRequiredProductionEnv("LINE_CHANNEL_ACCESS_TOKEN");
}

export function getLineChannelSecret() {
  if (!isProductionEnvironment()) {
    return readOptionalEnv("LINE_CHANNEL_SECRET");
  }

  return readRequiredProductionEnv("LINE_CHANNEL_SECRET");
}

export function getSentryDsn() {
  if (!isProductionEnvironment()) {
    return readOptionalEnv("SENTRY_DSN");
  }

  return readRequiredProductionEnv("SENTRY_DSN");
}

export function getOpsAlertWebhookUrl() {
  if (!isProductionEnvironment()) {
    return readOptionalEnv("OPS_ALERT_WEBHOOK_URL");
  }

  return readRequiredProductionEnv("OPS_ALERT_WEBHOOK_URL");
}

export function getProductionRuntimeValidationErrors() {
  if (!isProductionEnvironment()) {
    return [];
  }

  const missing = PRODUCTION_REQUIRED_ENV_NAMES.filter(
    (name) => !readOptionalEnv(name),
  );
  const errors = missing.map(
    (name) => `Missing required environment variable: ${name}`,
  );

  if (allowBearerAdminSessionFallback()) {
    errors.push(
      "ALLOW_BEARER_ADMIN_SESSION_FALLBACK must be false or unset in production",
    );
  }

  return errors;
}

export function validateProductionRuntimeConfig() {
  if (!isProductionEnvironment()) {
    return;
  }

  if (productionRuntimeValidated) {
    return;
  }

  const errors = getProductionRuntimeValidationErrors();
  if (errors.length > 0) {
    throw new EnvironmentConfigurationError(errors.join("; "));
  }

  productionRuntimeValidated = true;
}

export function resetProductionRuntimeValidationForTests() {
  productionRuntimeValidated = false;
}

export function getRateLimitConfig() {
  const prefix = readOptionalEnv("RATE_LIMIT_PREFIX") ?? "tendy";

  if (!isProductionEnvironment()) {
    return {
      prefix,
      url: readOptionalEnv("UPSTASH_REDIS_REST_URL"),
      token: readOptionalEnv("UPSTASH_REDIS_REST_TOKEN"),
    };
  }

  return {
    prefix,
    url: readRequiredProductionEnv("UPSTASH_REDIS_REST_URL"),
    token: readRequiredProductionEnv("UPSTASH_REDIS_REST_TOKEN"),
  };
}

export function isEnvironmentConfigurationError(error: unknown) {
  return error instanceof EnvironmentConfigurationError;
}
