import type { CSSProperties } from "react";
import { getProgressBarMetrics } from "@/lib/progress-bar";

interface ProgressBarProps {
  currentQty: number;
  goalQty: number | null;
  stockLimitQty?: number | null;
  unit?: string;
}

export function ProgressBar({
  currentQty,
  goalQty,
  stockLimitQty,
  unit = "份",
}: ProgressBarProps) {
  const metrics = getProgressBarMetrics({ currentQty, goalQty, stockLimitQty });

  if (!metrics) return null;

  if (metrics.mode === "goal") {
    return (
      <div className="mt-3 space-y-1.5">
        <div className="flex items-center justify-between gap-3 text-[11px] tracking-[0.06em]">
          <span
            className={
              metrics.reachedGoal
                ? "rounded-full border border-[rgba(95,126,92,0.2)] bg-[rgba(228,239,223,0.9)] px-2.5 py-1 font-semibold text-[rgb(65,98,61)]"
                : "text-[hsl(var(--muted-foreground))]"
            }
          >
            {metrics.reachedGoal ? "已達標" : `目標 ${metrics.goalQty}${unit}`}
          </span>
          <span className="font-medium text-[hsl(var(--muted-foreground))]">
            {metrics.currentQty}/{metrics.goalQty} ({metrics.fillPct}%)
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-[rgba(104,113,103,0.16)]">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              metrics.reachedGoal
                ? "bg-[linear-gradient(90deg,rgba(70,108,83,0.92),rgba(120,147,115,0.82))]"
                : "bg-[linear-gradient(90deg,rgba(179,132,70,0.92),rgba(214,174,102,0.78))]"
            }`}
            style={{ width: `${metrics.fillPct}%` }}
          />
        </div>
      </div>
    );
  }

  const markerStyle: CSSProperties =
    metrics.goalMarkerAlign === "start"
      ? { left: 0 }
      : metrics.goalMarkerAlign === "end"
        ? { right: 0 }
        : { left: `${metrics.goalMarkerPct}%`, transform: "translateX(-50%)" };

  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center justify-between gap-3 text-[11px] tracking-[0.06em]">
        <span className="rounded-full border border-[rgba(177,140,92,0.22)] bg-[rgba(255,251,246,0.88)] px-2.5 py-1 font-semibold text-[hsl(var(--ink))]">
          庫存上限 {metrics.stockLimitQty}
          {unit}
        </span>
        <span
          className={`font-semibold ${
            metrics.reachedGoal
              ? "text-[rgb(65,98,61)]"
              : "text-[hsl(var(--muted-foreground))]"
          }`}
        >
          已預訂 {metrics.currentQty}/{metrics.stockLimitQty}
          {unit}
        </span>
      </div>
      <div className="relative pt-7">
        <div
          className="pointer-events-none absolute top-0 z-10 flex flex-col items-center gap-1"
          style={markerStyle}
        >
          <span className="rounded-full border border-[rgba(177,140,92,0.24)] bg-[rgba(255,251,246,0.96)] px-2 py-1 text-[10px] font-semibold tracking-[0.06em] whitespace-nowrap text-[hsl(var(--ink))] shadow-[0_12px_24px_-20px_rgba(31,40,32,0.65)]">
            成團目標 {metrics.goalQty}
            {unit}
          </span>
          <span className="h-5 w-[2px] rounded-full bg-[rgba(57,66,60,0.78)]" />
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[rgba(104,113,103,0.16)]">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              metrics.reachedGoal
                ? "bg-[linear-gradient(90deg,rgba(70,108,83,0.92),rgba(120,147,115,0.82))]"
                : "bg-[linear-gradient(90deg,rgba(179,132,70,0.92),rgba(214,174,102,0.78))]"
            }`}
            style={{ width: `${metrics.fillPct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
