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
    try {
      const data = await adminFetch<{ rounds: Round[] }>("/api/rounds?all=true");
      setRounds(data.rounds);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [adminFetch]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const currentRound = rounds.find((r) => r.is_open);
  const pastRounds = rounds.filter((r) => !r.is_open).slice(0, 5);

  const updateRound = async (id: string, fields: Record<string, unknown>, msg: string) => {
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
      "截止時間已更新"
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
        <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="font-bold text-gray-700 text-sm">開團管理</h3>

      {/* Current Round */}
      {currentRound ? (
        <div className="bg-white rounded-xl border p-4 space-y-3">
          <div className="flex justify-between items-start">
            <div>
              <div className="font-bold">{currentRound.name}</div>

              {/* Deadline */}
              {editingDeadline ? (
                <div className="flex items-center gap-1.5 mt-1">
                  <input
                    type="datetime-local"
                    value={deadlineInput}
                    onChange={(e) => setDeadlineInput(e.target.value)}
                    className="border rounded-lg px-2 py-1 text-sm"
                    autoFocus
                  />
                  <button
                    onClick={saveDeadline}
                    className="text-xs bg-blue-600 text-white px-2.5 py-1 rounded-lg"
                  >
                    儲存
                  </button>
                  <button
                    onClick={() => setEditingDeadline(false)}
                    className="text-xs text-gray-400"
                  >
                    取消
                  </button>
                </div>
              ) : (
                <div className="text-xs text-gray-400 mt-0.5">
                  截止{" "}
                  {currentRound.deadline
                    ? new Date(currentRound.deadline).toLocaleString("zh-TW")
                    : "未設定"}
                </div>
              )}

              {/* Shipping fee */}
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-blue-500">宅配運費：</span>
                {editingFee ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-400">$</span>
                    <input
                      type="number"
                      min="0"
                      value={feeInput}
                      onChange={(e) => setFeeInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveFee();
                        if (e.key === "Escape") setEditingFee(false);
                      }}
                      className="w-20 border rounded-lg px-2 py-1 text-sm font-bold"
                      autoFocus
                    />
                    <button
                      onClick={saveFee}
                      className="text-xs bg-blue-600 text-white px-2.5 py-1 rounded-lg"
                    >
                      儲存
                    </button>
                    <button
                      onClick={() => setEditingFee(false)}
                      className="text-xs text-gray-400"
                    >
                      取消
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-blue-600">
                      {currentRound.shipping_fee != null
                        ? formatCurrency(currentRound.shipping_fee)
                        : "未設定"}
                    </span>
                    <button
                      onClick={() => {
                        setFeeInput(
                          String(currentRound.shipping_fee ?? 0)
                        );
                        setEditingFee(true);
                      }}
                      className="text-xs text-gray-400 hover:text-blue-500 underline"
                    >
                      修改
                    </button>
                  </div>
                )}
              </div>
            </div>
            <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700">
              開團中
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={closeRound}
              className="flex-1 bg-red-600 text-white rounded-xl py-2 text-sm font-medium"
            >
              截單
            </button>
            <button
              onClick={() => {
                const dl = currentRound.deadline
                  ? new Date(currentRound.deadline)
                      .toISOString()
                      .slice(0, 16)
                  : "";
                setDeadlineInput(dl);
                setEditingDeadline(true);
              }}
              className="flex-1 border rounded-xl py-2 text-sm"
            >
              改截止
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border p-4 text-center text-gray-400 text-sm">
          目前沒有進行中的團購
        </div>
      )}

      {/* New Round */}
      {showNewForm ? (
        <form
          onSubmit={createRound}
          className="bg-white rounded-xl border p-4 space-y-3"
        >
          <div className="font-medium text-sm text-gray-700">新開一團</div>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="團名（例：第13團：三月第四週）"
            className="w-full border rounded-xl px-3 py-2.5 text-sm"
            required
            autoFocus
          />
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs text-gray-500">截止時間</label>
              <input
                type="datetime-local"
                value={newDeadline}
                onChange={(e) => setNewDeadline(e.target.value)}
                className="w-full border rounded-xl px-3 py-2.5 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-500">宅配運費</label>
              <input
                type="number"
                min="0"
                value={newFee}
                onChange={(e) => setNewFee(e.target.value)}
                placeholder="0"
                className="w-full border rounded-xl px-3 py-2.5 text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowNewForm(false)}
              className="flex-1 border rounded-xl py-2.5 text-sm"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={creating || !newName.trim()}
              className="flex-1 bg-indigo-600 text-white rounded-xl py-2.5 font-bold text-sm disabled:opacity-50"
            >
              {creating ? "建立中…" : "建立"}
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setShowNewForm(true)}
          className="w-full bg-indigo-600 text-white rounded-xl py-3 font-bold"
        >
          + 新開一團
        </button>
      )}

      {/* History */}
      {pastRounds.length > 0 && (
        <div className="bg-white rounded-xl border p-3">
          <div className="font-medium text-sm mb-2 text-gray-700">
            歷史記錄
          </div>
          {pastRounds.map((r) => (
            <div
              key={r.id}
              className="flex justify-between text-sm text-gray-500 py-1.5 border-b last:border-0"
            >
              <span>{r.name}</span>
              <span className="text-xs text-gray-300">已截單</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
