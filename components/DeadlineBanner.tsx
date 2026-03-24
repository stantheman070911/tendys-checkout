"use client";

import { useState, useEffect } from "react";

interface DeadlineBannerProps {
  deadline: string | null;
  isOpen: boolean;
  roundName?: string;
}

export function DeadlineBanner({
  deadline,
  isOpen,
  roundName,
}: DeadlineBannerProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!isOpen || !deadline) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [isOpen, deadline]);

  if (!isOpen) {
    return (
      <div className="lux-panel rounded-[1.4rem] border-[rgba(189,111,98,0.22)] bg-[rgba(246,225,220,0.82)] p-4 text-center text-sm font-medium text-[rgb(140,67,56)]">
        本團已截單
      </div>
    );
  }

  if (!deadline) return null;

  const deadlineDate = new Date(deadline);
  const remaining = deadlineDate.getTime() - now;

  if (remaining <= 0) {
    return (
      <div className="lux-panel rounded-[1.4rem] border-[rgba(189,111,98,0.22)] bg-[rgba(246,225,220,0.82)] p-4 text-center text-sm font-medium text-[rgb(140,67,56)]">
        本團已截單
      </div>
    );
  }

  const hrs = Math.max(0, Math.floor(remaining / 3600000));
  const mins = Math.max(0, Math.floor((remaining % 3600000) / 60000));
  const dateStr = deadlineDate.toLocaleDateString("zh-TW");
  const timeStr = deadlineDate.toLocaleTimeString("zh-TW", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const isUrgent = hrs < 1;
  return (
    <div className="lux-panel-strong overflow-hidden p-4 md:p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <div className="lux-kicker">Round Window</div>
          <div className="text-sm text-[hsl(var(--ink))] md:text-base">
            {roundName && <span className="font-medium">{roundName}</span>}
            {roundName && <span className="mx-2 text-[hsl(var(--bronze))]">•</span>}
            截止 {dateStr} {timeStr}
          </div>
        </div>
        <div
          className={`inline-flex w-fit items-center rounded-full border px-3.5 py-2 text-xs font-semibold tracking-[0.18em] ${
            isUrgent
              ? "border-[rgba(189,111,98,0.22)] bg-[rgba(246,225,220,0.82)] text-[rgb(140,67,56)]"
              : "border-[rgba(184,132,71,0.2)] bg-[rgba(242,228,203,0.84)] text-[rgb(120,84,39)]"
          }`}
        >
          {isUrgent ? `剩 ${mins} 分鐘` : hrs < 48 ? `剩 ${hrs}h ${mins}m` : "開放中"}
        </div>
      </div>
    </div>
  );
}
