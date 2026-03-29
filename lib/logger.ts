export type LogLevel = "info" | "warn" | "error";
export type AuthMode = "cookie" | "bearer" | "none";

export interface LogEvent {
  event: string;
  level?: LogLevel;
  requestId?: string | null;
  route?: string | null;
  authMode?: AuthMode | null;
  orderId?: string | null;
  roundId?: string | null;
  productId?: string | null;
  jobId?: string | null;
  error?: unknown;
  details?: Record<string, unknown>;
}

function normalizeError(error: unknown) {
  if (!error) {
    return null;
  }

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack ?? null,
    };
  }

  if (typeof error === "string") {
    return { message: error };
  }

  return { value: error };
}

export function getRequestId(input: Headers | Request | null | undefined) {
  if (!input) {
    return null;
  }

  if (input instanceof Request) {
    return input.headers.get("x-request-id");
  }

  return input.get("x-request-id");
}

export function getRouteFromRequest(request: Request | { url: string }) {
  return new URL(request.url).pathname;
}

function emit(level: LogLevel, event: LogEvent) {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    event: event.event,
    requestId: event.requestId ?? null,
    route: event.route ?? null,
    authMode: event.authMode ?? null,
    orderId: event.orderId ?? null,
    roundId: event.roundId ?? null,
    productId: event.productId ?? null,
    jobId: event.jobId ?? null,
    error: normalizeError(event.error),
    details: event.details ?? null,
  };

  const line = JSON.stringify(payload);
  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.info(line);
}

export function logInfo(event: LogEvent) {
  emit("info", event);
}

export function logWarn(event: LogEvent) {
  emit("warn", event);
}

export function logError(event: LogEvent) {
  emit("error", event);
}
