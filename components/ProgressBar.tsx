interface ProgressBarProps {
  currentQty: number;
  goalQty: number | null;
}

export function ProgressBar({ currentQty, goalQty }: ProgressBarProps) {
  if (goalQty === null || goalQty === 0) return null;

  const pct = Math.min(100, Math.round((currentQty / goalQty) * 100));
  const reached = pct >= 100;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
        <span>
          {currentQty}/{goalQty} {reached ? "🎉" : ""}
        </span>
        <span>{pct}%</span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${reached ? "bg-green-500" : "bg-orange-400"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
