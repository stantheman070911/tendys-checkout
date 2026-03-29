import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { verifyLineSignature } from "./webhook";

describe("verifyLineSignature", () => {
  const originalSecret = process.env.LINE_CHANNEL_SECRET;

  afterEach(() => {
    process.env.LINE_CHANNEL_SECRET = originalSecret;
  });

  it("accepts a valid signature", () => {
    process.env.LINE_CHANNEL_SECRET = "line-secret";
    const body = JSON.stringify({ events: [{ type: "message" }] });
    const signature = createHmac("SHA256", "line-secret")
      .update(body)
      .digest("base64");

    expect(verifyLineSignature(body, signature)).toBe(true);
  });

  it("rejects an invalid signature", () => {
    process.env.LINE_CHANNEL_SECRET = "line-secret";

    expect(verifyLineSignature('{"ok":true}', "invalid-signature")).toBe(false);
  });

  it("rejects an empty signature", () => {
    process.env.LINE_CHANNEL_SECRET = "line-secret";

    expect(verifyLineSignature('{"ok":true}', "")).toBe(false);
  });

  it("rejects when the secret is missing", () => {
    delete process.env.LINE_CHANNEL_SECRET;

    expect(verifyLineSignature('{"ok":true}', "anything")).toBe(false);
  });
});
