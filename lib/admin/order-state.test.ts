import { describe, expect, it } from "vitest";
import {
  applyBatchStatusTransition,
  applyPendingCountDelta,
  getPendingConfirmCountDelta,
  removeBatchItemsById,
  removeItemsById,
  replaceItemById,
} from "./order-state";

interface TestOrder {
  id: string;
  status:
    | "pending_payment"
    | "pending_confirm"
    | "confirmed"
    | "shipped"
    | "cancelled";
  label?: string;
  confirmed_at?: string | null;
}

describe("replaceItemById", () => {
  it("replaces a matching item and preserves array order", () => {
    const items: TestOrder[] = [
      { id: "1", status: "pending_payment", label: "first" },
      { id: "2", status: "pending_confirm", label: "second" },
    ];

    expect(
      replaceItemById(items, {
        id: "2",
        status: "confirmed",
        label: "updated",
      }),
    ).toEqual([
      { id: "1", status: "pending_payment", label: "first" },
      { id: "2", status: "confirmed", label: "updated" },
    ]);
  });
});

describe("applyBatchStatusTransition", () => {
  it("patches only targeted non-skipped items", () => {
    const items: TestOrder[] = [
      { id: "1", status: "pending_confirm", confirmed_at: null },
      { id: "2", status: "pending_confirm", confirmed_at: null },
      { id: "3", status: "confirmed", confirmed_at: null },
    ];

    expect(
      applyBatchStatusTransition(items, {
        ids: ["1", "2", "3"],
        skippedIds: ["2"],
        fromStatus: "pending_confirm",
        toStatus: "confirmed",
        patch: (item) => ({ ...item, confirmed_at: "2026-03-25T00:00:00.000Z" }),
      }),
    ).toEqual([
      {
        id: "1",
        status: "confirmed",
        confirmed_at: "2026-03-25T00:00:00.000Z",
      },
      { id: "2", status: "pending_confirm", confirmed_at: null },
      { id: "3", status: "confirmed", confirmed_at: null },
    ]);
  });
});

describe("removeItemsById", () => {
  it("removes only matching ids", () => {
    expect(
      removeItemsById(
        [
          { id: "1", status: "confirmed" },
          { id: "2", status: "confirmed" },
          { id: "3", status: "confirmed" },
        ],
        ["1", "3"],
      ),
    ).toEqual([{ id: "2", status: "confirmed" }]);
  });

  it("removes batch ids except skipped ids", () => {
    expect(
      removeBatchItemsById(
        [
          { id: "1", status: "confirmed" },
          { id: "2", status: "confirmed" },
          { id: "3", status: "confirmed" },
        ],
        ["1", "2"],
        ["2"],
      ),
    ).toEqual([
      { id: "2", status: "confirmed" },
      { id: "3", status: "confirmed" },
    ]);
  });
});

describe("pending confirm helpers", () => {
  it("returns a decrement only when leaving pending_confirm", () => {
    expect(getPendingConfirmCountDelta("pending_confirm", "confirmed")).toBe(-1);
    expect(getPendingConfirmCountDelta("pending_confirm", "cancelled")).toBe(-1);
    expect(getPendingConfirmCountDelta("pending_payment", "confirmed")).toBe(0);
  });

  it("never lets the pending count go below zero", () => {
    expect(applyPendingCountDelta(3, -1)).toBe(2);
    expect(applyPendingCountDelta(0, -1)).toBe(0);
  });
});
