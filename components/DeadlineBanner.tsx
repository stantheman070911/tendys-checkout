"use client";

import { useState, useEffect } from "react";

interface DeadlineBannerProps {
  deadline: string | null;
  isOpen: boolean;
  roundName?: string;
}

export function DeadlineBanner({ deadline, isOpen, roundName }: DeadlineBannerProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!isOpen || !deadline) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [isOpen, deadline]);

  if (!isOpen) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-2.5 text-sm text-red-700 text-center font-medium">
        本團已截單
      </div>
    );
  }

  if (!deadline) return null;

  const deadlineDate = new Date(deadline);
  const remaining = deadlineDate.getTime() - now;

  if (remaining <= 0) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-2.5 text-sm text-red-700 text-center font-medium">
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

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-sm text-amber-800 text-center">
      {roundName && <span className="font-medium">{roundName}</span>}
      {roundName && "\u3000"}截止 {dateStr} {timeStr}
      {hrs < 48 && (
        <span className="ml-2 text-red-600 font-bold">
          剩 {hrs}h {mins}m
        </span>
      )}
    </div>
  );
}
