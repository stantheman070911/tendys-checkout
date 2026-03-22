import { createHmac, timingSafeEqual } from "crypto";

/**
 * Verify the LINE webhook signature.
 * Computes HMAC-SHA256 of the raw request body using LINE_CHANNEL_SECRET
 * and compares with the x-line-signature header value using timing-safe comparison.
 */
export function verifyLineSignature(body: string, signature: string): boolean {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret) return false;
  const hash = createHmac("SHA256", secret).update(body).digest("base64");
  const hashBuf = Buffer.from(hash);
  const sigBuf = Buffer.from(signature);
  if (hashBuf.length !== sigBuf.length) return false;
  return timingSafeEqual(hashBuf, sigBuf);
}
