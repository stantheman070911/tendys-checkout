export type ProgressBarMode = "goal" | "stock";

export interface ProgressBarMetrics {
  mode: ProgressBarMode;
  currentQty: number;
  goalQty: number;
  reachedGoal: boolean;
  fillPct: number;
  stockLimitQty: number | null;
  goalMarkerPct: number | null;
  goalMarkerAlign: "start" | "center" | "end";
}

function clampPct(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function deriveStockLimitQty(
  currentQty: number,
  remainingStock: number | null | undefined,
): number | null {
  if (
    !Number.isFinite(currentQty) ||
    currentQty < 0 ||
    remainingStock === null ||
    remainingStock === undefined ||
    !Number.isFinite(remainingStock) ||
    remainingStock < 0
  ) {
    return null;
  }

  const stockLimitQty = currentQty + remainingStock;
  return stockLimitQty > 0 ? stockLimitQty : null;
}

export function getProgressBarMetrics(input: {
  currentQty: number;
  goalQty: number | null;
  stockLimitQty?: number | null;
}): ProgressBarMetrics | null {
  const { goalQty, stockLimitQty } = input;

  if (goalQty === null || goalQty <= 0 || !Number.isFinite(goalQty)) {
    return null;
  }

  const currentQty = Math.max(
    0,
    Number.isFinite(input.currentQty) ? input.currentQty : 0,
  );
  const reachedGoal = currentQty >= goalQty;

  if (
    stockLimitQty !== null &&
    stockLimitQty !== undefined &&
    Number.isFinite(stockLimitQty) &&
    stockLimitQty > 0
  ) {
    const effectiveStockLimit = Math.max(stockLimitQty, currentQty);
    const goalMarkerPct = clampPct((goalQty / effectiveStockLimit) * 100);

    return {
      mode: "stock",
      currentQty,
      goalQty,
      reachedGoal,
      fillPct: clampPct((currentQty / effectiveStockLimit) * 100),
      stockLimitQty: effectiveStockLimit,
      goalMarkerPct,
      goalMarkerAlign:
        goalMarkerPct <= 12
          ? "start"
          : goalMarkerPct >= 88
            ? "end"
            : "center",
    };
  }

  return {
    mode: "goal",
    currentQty,
    goalQty,
    reachedGoal,
    fillPct: clampPct((currentQty / goalQty) * 100),
    stockLimitQty: null,
    goalMarkerPct: null,
    goalMarkerAlign: "center",
  };
}
