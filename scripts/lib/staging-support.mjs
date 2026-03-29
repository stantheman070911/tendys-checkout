import fs from "node:fs";
import path from "node:path";
import process from "node:process";

export function readEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function readOptionalEnv(...names) {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) {
      return value;
    }
  }
  return "";
}

export function normalizeBaseUrl(value) {
  const url = new URL(value);
  url.search = "";
  url.hash = "";
  if (!url.pathname.endsWith("/")) {
    url.pathname = `${url.pathname}/`;
  }
  return url.toString();
}

export function buildUrl(baseUrl, routePath) {
  return new URL(routePath, baseUrl).toString();
}

export function getProtectionBypassSecret() {
  return readOptionalEnv(
    "STAGING_VERCEL_BYPASS_SECRET",
    "VERCEL_AUTOMATION_BYPASS_SECRET",
  );
}

export function hasProtectionBypassSecret() {
  return getProtectionBypassSecret().length > 0;
}

export function buildProtectionHeaders() {
  const secret = getProtectionBypassSecret();
  if (!secret) {
    return {};
  }

  return {
    "x-vercel-protection-bypass": secret,
    "x-vercel-set-bypass-cookie": "true",
  };
}

export function appendProtectionQuery(urlString) {
  const secret = getProtectionBypassSecret();
  if (!secret) {
    return urlString;
  }

  const url = new URL(urlString);
  url.searchParams.set("x-vercel-protection-bypass", secret);
  url.searchParams.set("x-vercel-set-bypass-cookie", "true");
  return url.toString();
}

export function isProtectionPage(status, payload) {
  return (
    status === 401 &&
    typeof payload === "string" &&
    /Authentication Required|Deployment Protection|Vercel Authentication/i.test(
      payload,
    )
  );
}

export function formatRequestFailure(baseUrl, routePath, method, status, payload) {
  if (isProtectionPage(status, payload)) {
    const envHint = hasProtectionBypassSecret()
      ? "The configured bypass secret was rejected or no longer matches this deployment."
      : "Set STAGING_VERCEL_BYPASS_SECRET (or VERCEL_AUTOMATION_BYPASS_SECRET) and rerun.";

    return `${method} ${routePath} was blocked by Vercel Deployment Protection at ${baseUrl}. ${envHint}`;
  }

  return `${method} ${routePath} failed (${status}): ${
    typeof payload === "string"
      ? payload
      : payload?.error ?? JSON.stringify(payload)
  }`;
}

export function ensureArtifactsDir() {
  fs.mkdirSync(path.join(process.cwd(), "artifacts"), { recursive: true });
}

export function buildSmokeArtifactPaths(runId) {
  ensureArtifactsDir();
  return {
    logPath: path.join("artifacts", `staging-smoke-${runId}.log`),
    summaryPath: path.join("artifacts", `staging-smoke-${runId}.json`),
  };
}

export function createLineLogger(logPath) {
  ensureArtifactsDir();
  fs.writeFileSync(logPath, "");

  function write(line) {
    process.stdout.write(`${line}\n`);
    fs.appendFileSync(logPath, `${line}\n`);
  }

  return {
    log(value = "") {
      const message =
        typeof value === "string" ? value : JSON.stringify(value, null, 2);
      for (const line of message.split("\n")) {
        write(line);
      }
    },
  };
}

export function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

export function parseCliArgs(argv) {
  const result = {};

  for (const arg of argv) {
    if (!arg.startsWith("--")) {
      continue;
    }

    const trimmed = arg.slice(2);
    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex === -1) {
      result[trimmed] = "true";
      continue;
    }

    result[trimmed.slice(0, equalsIndex)] = trimmed.slice(equalsIndex + 1);
  }

  return result;
}

export function resolveSmokeSummaryPath(args) {
  const summaryPath = args["summary-path"]?.trim();
  if (summaryPath) {
    return summaryPath;
  }

  const runId = args["run-id"]?.trim();
  if (runId) {
    return path.join("artifacts", `staging-smoke-${runId}.json`);
  }

  throw new Error(
    "Missing smoke summary selector. Pass --run-id=<runId> or --summary-path=<path>.",
  );
}

export function parseSmokeSummary(summaryPath) {
  return JSON.parse(fs.readFileSync(summaryPath, "utf8"));
}

export function sameBaseUrl(left, right) {
  return normalizeBaseUrl(left) === normalizeBaseUrl(right);
}

export function createProtectedFetchSession() {
  const cookieJar = new Map();

  function readSetCookieHeaders(headers) {
    if (typeof headers.getSetCookie === "function") {
      return headers.getSetCookie();
    }

    const value = headers.get("set-cookie");
    return value ? value.split(/,(?=[^;]+?=)/g) : [];
  }

  function buildCookieHeader() {
    return Array.from(cookieJar.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }

  return {
    async fetch(url, init = {}) {
      let nextUrl = url;

      for (let attempt = 0; attempt < 3; attempt += 1) {
        const response = await fetch(nextUrl, {
          ...init,
          redirect: "manual",
          headers: {
            ...buildProtectionHeaders(),
            ...(cookieJar.size > 0 ? { Cookie: buildCookieHeader() } : {}),
            ...(init.headers ?? {}),
          },
        });

        for (const setCookie of readSetCookieHeaders(response.headers)) {
          const [cookiePair] = setCookie.split(/;\s*/);
          const separator = cookiePair.indexOf("=");
          if (separator === -1) {
            continue;
          }

          const name = cookiePair.slice(0, separator);
          const value = cookiePair.slice(separator + 1);
          cookieJar.set(name, value);
        }

        const location = response.headers.get("location");
        if (
          response.status >= 300 &&
          response.status < 400 &&
          location
        ) {
          nextUrl = new URL(location, nextUrl).toString();
          continue;
        }

        return response;
      }

      throw new Error(`Exceeded protected redirect attempts for ${url}`);
    },
    getBypassCookie() {
      const value = cookieJar.get("_vercel_jwt");
      return value ? `_vercel_jwt=${value}` : "";
    },
    getCookie(name) {
      const value = cookieJar.get(name);
      return value ? `${name}=${value}` : "";
    },
  };
}
