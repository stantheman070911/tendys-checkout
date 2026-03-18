interface ProgressBarProps {
  currentQty: number;
  goalQty: number | null;
  unit?: string;
}

export function ProgressBar({ currentQty, goalQty, unit = "份" }: ProgressBarProps) {
  if (goalQty === null || goalQty === 0) return null;

  const pct = Math.min(100, Math.round((currentQty / goalQty) * 100));
  const reached = currentQty >= goalQty;

  return (
    <div className="mt-1.5">
      <div className="flex justify-between text-xs mb-0.5">
        <span className={reached ? "text-green-600 font-medium" : "text-orange-500"}>
          {reached ? "達標" : `目標 ${goalQty}${unit}`}
        </span>
        <span className="text-gray-400">
          {currentQty}/{goalQty} ({pct}%)
        </span>
      </div>
      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${reached ? "bg-green-500" : "bg-orange-400"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
