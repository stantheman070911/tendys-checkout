import { describe, it, expect } from "vitest";
import {
  mapNotifyStatus,
  renderNotifyIcon,
  type NotificationPayload,
} from "./shipment-status";

describe("mapNotifyStatus", () => {
  it("maps both channels successful", () => {
    const payload: NotificationPayload = {
      line: { success: true },
      email: { success: true },
    };
    expect(mapNotifyStatus(payload)).toEqual({
      line: "success",
      email: "success",
    });
  });

  it("maps both channels failed", () => {
    const payload: NotificationPayload = {
      line: { success: false, error: "API error" },
      email: { success: false, error: "Bounce" },
    };
    expect(mapNotifyStatus(payload)).toEqual({
      line: "failed",
      email: "failed",
    });
  });

  it("maps LINE skipped when no LINE user linked", () => {
    const payload: NotificationPayload = {
      line: { success: false, error: "No LINE user linked" },
      email: { success: true },
    };
    expect(mapNotifyStatus(payload)).toEqual({
      line: "skipped",
      email: "success",
    });
  });

  it("maps email skipped when null (no email on user)", () => {
    const payload: NotificationPayload = {
      line: { success: true },
      email: null,
    };
    expect(mapNotifyStatus(payload)).toEqual({
      line: "success",
      email: "skipped",
    });
  });

  it("maps both skipped when notifications undefined", () => {
    expect(mapNotifyStatus(undefined)).toEqual({
      line: "skipped",
      email: "skipped",
    });
  });

  it("maps LINE skipped when line field missing", () => {
    const payload: NotificationPayload = {
      email: { success: true },
    };
    expect(mapNotifyStatus(payload)).toEqual({
      line: "skipped",
      email: "success",
    });
  });

  it("maps email skipped when email field missing (undefined)", () => {
    const payload: NotificationPayload = {
      line: { success: true },
    };
    expect(mapNotifyStatus(payload)).toEqual({
      line: "success",
      email: "skipped",
    });
  });

  it("distinguishes LINE failed from LINE skipped", () => {
    const failed = mapNotifyStatus({
      line: { success: false, error: "Rate limited" },
    });
    const skipped = mapNotifyStatus({
      line: { success: false, error: "No LINE user linked" },
    });
    expect(failed.line).toBe("failed");
    expect(skipped.line).toBe("skipped");
  });
});

describe("renderNotifyIcon", () => {
  it("returns ✓ for success", () => {
    expect(renderNotifyIcon("success")).toBe("✓");
  });

  it("returns — for skipped", () => {
    expect(renderNotifyIcon("skipped")).toBe("—");
  });

  it("returns ✗ for failed", () => {
    expect(renderNotifyIcon("failed")).toBe("✗");
  });
});
