interface ProgressBarProps {
  currentQty: number;
  goalQty: number | null;
  unit?: string;
}

export function ProgressBar({
  currentQty,
  goalQty,
  unit = "份",
}: ProgressBarProps) {
  if (goalQty === null || goalQty === 0) return null;

  const pct = Math.min(100, Math.round((currentQty / goalQty) * 100));
  const reached = currentQty >= goalQty;

  return (
    <div className="mt-3 space-y-1.5">
      <div className="flex items-center justify-between gap-3 text-[11px] tracking-[0.06em]">
        <span
          className={
            reached
              ? "rounded-full border border-[rgba(95,126,92,0.2)] bg-[rgba(228,239,223,0.9)] px-2.5 py-1 font-semibold text-[rgb(65,98,61)]"
              : "text-[hsl(var(--muted-foreground))]"
          }
        >
          {reached ? "已達標" : `目標 ${goalQty}${unit}`}
        </span>
        <span className="font-medium text-[hsl(var(--muted-foreground))]">
          {currentQty}/{goalQty} ({pct}%)
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[rgba(104,113,103,0.16)]">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            reached
              ? "bg-[linear-gradient(90deg,rgba(70,108,83,0.92),rgba(120,147,115,0.82))]"
              : "bg-[linear-gradient(90deg,rgba(179,132,70,0.92),rgba(214,174,102,0.78))]"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
