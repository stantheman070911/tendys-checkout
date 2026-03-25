import { describe, expect, it } from "vitest";
import {
  deriveStockLimitQty,
  getProgressBarMetrics,
} from "@/lib/progress-bar";

describe("deriveStockLimitQty", () => {
  it("returns current ordered plus remaining stock", () => {
    expect(deriveStockLimitQty(12, 3)).toBe(15);
  });

  it("returns null for invalid or empty totals", () => {
    expect(deriveStockLimitQty(0, 0)).toBeNull();
    expect(deriveStockLimitQty(6, -1)).toBeNull();
    expect(deriveStockLimitQty(4, null)).toBeNull();
  });
});

describe("getProgressBarMetrics", () => {
  it("uses stock-cap mode below the goal", () => {
    expect(
      getProgressBarMetrics({
        currentQty: 4,
        goalQty: 10,
        stockLimitQty: 16,
      }),
    ).toEqual({
      mode: "stock",
      currentQty: 4,
      goalQty: 10,
      reachedGoal: false,
      fillPct: 25,
      stockLimitQty: 16,
      goalMarkerPct: 63,
      goalMarkerAlign: "center",
    });
  });

  it("keeps a partial fill after the goal is reached but stock remains", () => {
    expect(
      getProgressBarMetrics({
        currentQty: 12,
        goalQty: 10,
        stockLimitQty: 15,
      }),
    ).toEqual({
      mode: "stock",
      currentQty: 12,
      goalQty: 10,
      reachedGoal: true,
      fillPct: 80,
      stockLimitQty: 15,
      goalMarkerPct: 67,
      goalMarkerAlign: "center",
    });
  });

  it("clamps the goal marker when the goal exceeds the stock cap", () => {
    expect(
      getProgressBarMetrics({
        currentQty: 4,
        goalQty: 12,
        stockLimitQty: 10,
      }),
    ).toEqual({
      mode: "stock",
      currentQty: 4,
      goalQty: 12,
      reachedGoal: false,
      fillPct: 40,
      stockLimitQty: 10,
      goalMarkerPct: 100,
      goalMarkerAlign: "end",
    });
  });

  it("falls back to goal-only mode when there is no stock cap", () => {
    expect(
      getProgressBarMetrics({
        currentQty: 4,
        goalQty: 10,
      }),
    ).toEqual({
      mode: "goal",
      currentQty: 4,
      goalQty: 10,
      reachedGoal: false,
      fillPct: 40,
      stockLimitQty: null,
      goalMarkerPct: null,
      goalMarkerAlign: "center",
    });
  });

  it("falls back to goal-only mode for invalid finite stock inputs", () => {
    expect(
      getProgressBarMetrics({
        currentQty: 4,
        goalQty: 10,
        stockLimitQty: 0,
      }),
    ).toEqual({
      mode: "goal",
      currentQty: 4,
      goalQty: 10,
      reachedGoal: false,
      fillPct: 40,
      stockLimitQty: null,
      goalMarkerPct: null,
      goalMarkerAlign: "center",
    });
  });
});
