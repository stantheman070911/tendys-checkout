"use client";

import { useEffect, useState, useCallback } from "react";
import { useAdminFetch } from "@/hooks/use-admin-fetch";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import type { Round } from "@/types";

export default function RoundsPage() {
  const { adminFetch } = useAdminFetch();
  const { toast } = useToast();
  const [rounds, setRounds] = useState<Round[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Inline edit states for current round
  const [editingFee, setEditingFee] = useState(false);
  const [feeInput, setFeeInput] = useState("");
  const [editingDeadline, setEditingDeadline] = useState(false);
  const [deadlineInput, setDeadlineInput] = useState("");

  // New round form
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDeadline, setNewDeadline] = useState("");
  const [newFee, setNewFee] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchData = useCallback(async () => {
    setError(null);
    try {
      const data = await adminFetch<{ rounds: Round[] }>(
        "/api/rounds?all=true",
      );
      setRounds(data.rounds);
    } catch (error) {
      setError(error instanceof Error ? error.message : "資料載入失敗");
    } finally {
      setLoading(false);
    }
  }, [adminFetch]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const currentRound = rounds.find((r) => r.is_open);
  const pastRounds = rounds.filter((r) => !r.is_open).slice(0, 5);

  const updateRound = async (
    id: string,
    fields: Record<string, unknown>,
    msg: string,
  ) => {
    try {
      await adminFetch("/api/rounds", {
        method: "PUT",
        body: JSON.stringify({ id, ...fields }),
      });
      toast({ title: msg });
      fetchData();
    } catch {
      toast({ title: "操作失敗", variant: "destructive" });
    }
  };

  const closeRound = () => {
    if (!currentRound) return;
    updateRound(currentRound.id, { is_open: false }, "已截單");
  };

  const saveFee = () => {
    if (!currentRound) return;
    const v = parseInt(feeInput);
    if (isNaN(v) || v < 0) {
      toast({ title: "請輸入有效金額", variant: "destructive" });
      return;
    }
    updateRound(currentRound.id, { shipping_fee: v }, "運費已更新");
    setEditingFee(false);
  };

  const saveDeadline = () => {
    if (!currentRound || !deadlineInput) return;
    updateRound(
      currentRound.id,
      { deadline: new Date(deadlineInput).toISOString() },
      "截止時間已更新",
    );
    setEditingDeadline(false);
  };

  const createRound = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await adminFetch("/api/rounds", {
        method: "POST",
        body: JSON.stringify({
          name: newName.trim(),
          deadline: newDeadline ? new Date(newDeadline).toISOString() : null,
          shipping_fee: newFee ? parseInt(newFee) : null,
        }),
      });
      toast({ title: "新團已建立" });
      setShowNewForm(false);
      setNewName("");
      setNewDeadline("");
      setNewFee("");
      fetchData();
    } catch {
      toast({ title: "建立失敗", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[hsl(var(--forest))] border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="lux-panel-strong p-5 md:p-6">
        <div className="space-y-2">
          <div className="lux-kicker">Round Planning</div>
          <h1 className="font-display text-3xl text-[hsl(var(--ink))] md:text-4xl">
            開團管理
          </h1>
          <p className="text-sm leading-6 text-[hsl(var(--muted-foreground))]">
            調整本輪截止時間、宅配運費，或建立下一輪團購。
          </p>
        </div>
      </section>

      {/* Current Round */}
      {currentRound ? (
        <div className="lux-panel p-5 space-y-4">
          <div className="flex justify-between items-start">
            <div>
              <div className="font-display text-2xl text-[hsl(var(--ink))]">
                {currentRound.name}
              </div>

              {/* Deadline */}
              {editingDeadline ? (
                <div className="mt-1 flex items-center gap-1.5">
                  <input
                    type="datetime-local"
                    value={deadlineInput}
                    onChange={(e) => setDeadlineInput(e.target.value)}
                    className="lux-input"
                    autoFocus
                  />
                  <button
                    onClick={saveDeadline}
                    className="rounded-full bg-[rgb(74,96,136)] px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    儲存
                  </button>
                  <button
                    onClick={() => setEditingDeadline(false)}
                    className="text-xs text-[hsl(var(--muted-foreground))]"
                  >
                    取消
                  </button>
                </div>
              ) : (
                <div className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">
                  截止{" "}
                  {currentRound.deadline
                    ? new Date(currentRound.deadline).toLocaleString("zh-TW")
                    : "未設定"}
                </div>
              )}

              {/* Shipping fee */}
              <div className="mt-1 flex items-center gap-2">
                <span className="text-xs text-[rgb(74,96,136)]">宅配運費：</span>
                {editingFee ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">$</span>
                    <input
                      type="number"
                      min="0"
                      value={feeInput}
                      onChange={(e) => setFeeInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveFee();
                        if (e.key === "Escape") setEditingFee(false);
                      }}
                      className="lux-input w-24 font-semibold"
                      autoFocus
                    />
                    <button
                      onClick={saveFee}
                      className="rounded-full bg-[rgb(74,96,136)] px-3 py-1.5 text-xs font-semibold text-white"
                    >
                      儲存
                    </button>
                    <button
                      onClick={() => setEditingFee(false)}
                      className="text-xs text-[hsl(var(--muted-foreground))]"
                    >
                      取消
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-[rgb(74,96,136)]">
                      {currentRound.shipping_fee != null
                        ? formatCurrency(currentRound.shipping_fee)
                        : "未設定"}
                    </span>
                    <button
                      onClick={() => {
                        setFeeInput(String(currentRound.shipping_fee ?? 0));
                        setEditingFee(true);
                      }}
                      className="text-xs text-[hsl(var(--muted-foreground))] underline"
                    >
                      修改
                    </button>
                  </div>
                )}
              </div>
            </div>
            <span className="rounded-full border border-[rgba(95,126,92,0.2)] bg-[rgba(228,239,223,0.82)] px-3 py-1 text-xs font-semibold text-[rgb(65,98,61)]">
              開團中
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={closeRound}
              className="flex-1 rounded-[1.1rem] bg-red-600 py-3 text-sm font-semibold text-white"
            >
              截單
            </button>
            <button
              onClick={() => {
                const dl = currentRound.deadline
                  ? new Date(currentRound.deadline).toISOString().slice(0, 16)
                  : "";
                setDeadlineInput(dl);
                setEditingDeadline(true);
              }}
              className="flex-1 rounded-[1.1rem] border border-[rgba(177,140,92,0.28)] bg-[rgba(255,251,246,0.9)] py-3 text-sm font-semibold text-[hsl(var(--ink))]"
            >
              改截止
            </button>
          </div>
        </div>
      ) : (
        <div className="lux-panel p-6 text-center text-sm text-[hsl(var(--muted-foreground))]">
          目前沒有進行中的團購
        </div>
      )}

      {/* New Round */}
      {showNewForm ? (
        <form
          onSubmit={createRound}
          className="lux-panel space-y-4 p-5"
        >
          <div className="font-display text-2xl text-[hsl(var(--ink))]">
            新開一團
          </div>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="團名（例：第13團：三月第四週）"
            className="lux-input"
            required
            autoFocus
          />
          <div className="grid gap-2 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium uppercase tracking-[0.16em] text-[hsl(var(--bronze))]">
                截止時間
              </label>
              <input
                type="datetime-local"
                value={newDeadline}
                onChange={(e) => setNewDeadline(e.target.value)}
                className="lux-input"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium uppercase tracking-[0.16em] text-[hsl(var(--bronze))]">
                宅配運費
              </label>
              <input
                type="number"
                min="0"
                value={newFee}
                onChange={(e) => setNewFee(e.target.value)}
                placeholder="0"
                className="lux-input"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowNewForm(false)}
              className="flex-1 rounded-[1.1rem] border border-[rgba(177,140,92,0.28)] bg-[rgba(255,251,246,0.9)] py-3 text-sm font-semibold text-[hsl(var(--ink))]"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={creating || !newName.trim()}
              className="flex-1 rounded-[1.1rem] bg-[hsl(var(--forest))] py-3 text-sm font-semibold text-[hsl(var(--mist))] disabled:opacity-50"
            >
              {creating ? "建立中…" : "建立"}
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setShowNewForm(true)}
          className="w-full rounded-[1.2rem] bg-[hsl(var(--forest))] py-4 font-semibold text-[hsl(var(--mist))]"
        >
          新開一團
        </button>
      )}

      {/* History */}
      {pastRounds.length > 0 && (
        <div className="lux-panel p-4">
          <div className="mb-3 font-display text-2xl text-[hsl(var(--ink))]">
            歷史記錄
          </div>
          {pastRounds.map((r) => (
            <div
              key={r.id}
              className="flex justify-between border-b border-[rgba(177,140,92,0.14)] py-2 text-sm text-[hsl(var(--muted-foreground))] last:border-0"
            >
              <span>{r.name}</span>
              <span className="text-xs">已截單</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
