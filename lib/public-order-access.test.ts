import { describe, expect, it } from "vitest";
import {
  parsePublicOrderAccess,
  serializePublicOrderAccess,
} from "@/lib/public-order-access";

describe("public order access payloads", () => {
  it("parses a lookup payload and keeps it reusable", () => {
    const payload = serializePublicOrderAccess(
      {
        recipient_name: "王小美",
        phone_last3: "678",
      },
      "lookup",
    );

    expect(parsePublicOrderAccess(payload)).toEqual({
      identity: {
        recipient_name: "王小美",
        phone_last3: "678",
      },
      source: "lookup",
      consumeOnUse: false,
    });
  });

  it("parses a checkout payload and marks it one-time", () => {
    const payload = serializePublicOrderAccess(
      {
        recipient_name: "王小美",
        phone_last3: "678",
      },
      "checkout",
    );

    expect(parsePublicOrderAccess(payload)).toEqual({
      identity: {
        recipient_name: "王小美",
        phone_last3: "678",
      },
      source: "checkout",
      consumeOnUse: true,
    });
  });

  it("keeps legacy payloads backward compatible", () => {
    expect(
      parsePublicOrderAccess(
        JSON.stringify({
          recipient_name: "王小美",
          phone_last3: "678",
        }),
      ),
    ).toEqual({
      identity: {
        recipient_name: "王小美",
        phone_last3: "678",
      },
      source: "legacy",
      consumeOnUse: true,
    });
  });

  it("rejects invalid payloads", () => {
    expect(parsePublicOrderAccess(null)).toBeNull();
    expect(parsePublicOrderAccess("not-json")).toBeNull();
    expect(
      parsePublicOrderAccess(
        JSON.stringify({
          recipient_name: "王小美",
          phone_last3: "67",
          source: "lookup",
        }),
      ),
    ).toBeNull();
  });
});
