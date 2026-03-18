import { createHmac } from "crypto";

/**
 * Verify the LINE webhook signature.
 * Computes HMAC-SHA256 of the raw request body using LINE_CHANNEL_SECRET
 * and compares with the x-line-signature header value.
 */
export function verifyLineSignature(body: string, signature: string): boolean {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret) return false;
  const hash = createHmac("SHA256", secret).update(body).digest("base64");
  return hash === signature;
}
