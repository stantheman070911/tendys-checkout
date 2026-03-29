import { NextResponse } from "next/server";
import { getRequestId, getRouteFromRequest, logError } from "@/lib/logger";
import { isEnvironmentConfigurationError } from "@/lib/server-env";

export function handleEnvironmentConfigurationError(
  request: Request,
  error: unknown,
  message: string,
) {
  if (!isEnvironmentConfigurationError(error)) {
    return null;
  }

  logError({
    event: "environment_configuration_error",
    requestId: getRequestId(request),
    route: getRouteFromRequest(request),
    error,
  });

  return NextResponse.json({ error: message }, { status: 503 });
}
