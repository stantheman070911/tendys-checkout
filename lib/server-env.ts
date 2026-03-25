export class EnvironmentConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnvironmentConfigurationError";
  }
}

const warnedFallbacks = new Set<string>();

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
