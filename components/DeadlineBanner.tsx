"use client";

import { useState, useEffect } from "react";

interface DeadlineBannerProps {
  deadline: string | null;
  isOpen: boolean;
}

function formatCountdown(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) return `${days}天 ${hours}時 ${minutes}分 ${seconds}秒`;
  if (hours > 0) return `${hours}時 ${minutes}分 ${seconds}秒`;
  return `${minutes}分 ${seconds}秒`;
}

export function DeadlineBanner({ deadline, isOpen }: DeadlineBannerProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!isOpen || !deadline) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [isOpen, deadline]);

  if (!isOpen) {
    return (
      <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-center text-red-700 font-medium">
        已截單
      </div>
    );
  }

  if (!deadline) return null;

  const deadlineMs = new Date(deadline).getTime();
  const remaining = deadlineMs - now;

  if (remaining <= 0) {
    return (
      <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-center text-red-700 font-medium">
        已截單
      </div>
    );
  }

  const urgent = remaining < 3600000; // < 1 hour

  return (
    <div
      className={`rounded-lg border px-4 py-3 text-center font-medium ${
        urgent
          ? "bg-orange-50 border-orange-200 text-orange-700"
          : "bg-blue-50 border-blue-200 text-blue-700"
      }`}
    >
      距離截單還有 {formatCountdown(remaining)}
    </div>
  );
}
