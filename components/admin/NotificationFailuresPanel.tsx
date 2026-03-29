"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import type { AdminNotificationFailureRow } from "@/types";

interface NotificationFailuresPanelProps {
  roundId: string;
  jobs: AdminNotificationFailureRow[];
}

const TYPE_LABELS: Record<AdminNotificationFailureRow["type"], string> = {
  payment_confirmed: "付款確認",
  shipment: "出貨通知",
  product_arrival: "到貨通知",
  order_cancelled: "取消通知",
};

export function NotificationFailuresPanel({
  roundId,
  jobs,
}: NotificationFailuresPanelProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  async function retry(body: { jobIds?: string[]; roundId?: string }, pending: string) {
    try {
      setPendingKey(pending);
      const response = await fetch("/api/notification-jobs/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error ?? "重試失敗");
      }

      toast({ title: `已重新排入 ${payload.requeued ?? 0} 筆通知` });
      router.refresh();
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : "重試失敗",
        variant: "destructive",
      });
    } finally {
      setPendingKey(null);
    }
  }

  return (
    <section className="lux-panel p-5">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="font-display text-2xl text-[hsl(var(--ink))]">
            通知失敗佇列
          </div>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
            僅顯示本團最近失敗的通知，可逐筆或整團重新排入背景 worker。
          </p>
        </div>
        <button
          type="button"
          onClick={() => retry({ roundId }, "all")}
          disabled={jobs.length === 0 || pendingKey !== null}
          className="inline-flex items-center justify-center rounded-full border border-[rgba(177,140,92,0.26)] px-4 py-2 text-sm font-semibold text-[hsl(var(--ink))] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pendingKey === "all" ? "重新排入中..." : "重試本團全部失敗通知"}
        </button>
      </div>

      {jobs.length === 0 ? (
        <div className="text-sm text-[hsl(var(--muted-foreground))]">
          目前沒有失敗通知。
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <div
              key={job.id}
              className="rounded-[1rem] border border-[rgba(177,140,92,0.16)] p-4"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-1">
                  <div className="text-xs uppercase tracking-[0.18em] text-[hsl(var(--bronze))]">
                    {TYPE_LABELS[job.type]} / {job.channel.toUpperCase()}
                  </div>
                  <div className="font-medium text-[hsl(var(--ink))]">
                    {job.recipient}
                  </div>
                  <div className="text-xs text-[hsl(var(--muted-foreground))]">
                    建立時間 {new Date(job.created_at).toLocaleString("zh-TW")}
                  </div>
                  <div className="text-xs text-[hsl(var(--muted-foreground))]">
                    已嘗試 {job.attempt_count} 次
                  </div>
                  {job.last_error && (
                    <div className="text-xs text-[rgb(140,67,56)]">
                      {job.last_error}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => retry({ jobIds: [job.id] }, job.id)}
                  disabled={pendingKey !== null}
                  className="inline-flex items-center justify-center rounded-full bg-[hsl(var(--ink))] px-4 py-2 text-sm font-semibold text-[hsl(var(--surface))] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {pendingKey === job.id ? "重試中..." : "重試這筆"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
