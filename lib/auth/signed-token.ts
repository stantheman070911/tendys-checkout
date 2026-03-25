import { createHmac, timingSafeEqual } from "crypto";

function encodeBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

export function signToken(payload: Record<string, unknown>, secret: string) {
  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const signature = createHmac("sha256", secret)
    .update(encodedPayload)
    .digest("base64url");

  return `${encodedPayload}.${signature}`;
}

export function verifyToken<T>(
  token: string | null | undefined,
  secret: string,
): T | null {
  if (!token) return null;

  const [encodedPayload, encodedSignature] = token.split(".");
  if (!encodedPayload || !encodedSignature) {
    return null;
  }

  try {
    const expectedSignature = createHmac("sha256", secret)
      .update(encodedPayload)
      .digest();
    const receivedSignature = Buffer.from(encodedSignature, "base64url");

    if (
      expectedSignature.length !== receivedSignature.length ||
      !timingSafeEqual(expectedSignature, receivedSignature)
    ) {
      return null;
    }

    return JSON.parse(decodeBase64Url(encodedPayload)) as T;
  } catch {
    return null;
  }
}
