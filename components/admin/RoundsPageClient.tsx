"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminFetch } from "@/hooks/use-admin-fetch";
import { useToast } from "@/hooks/use-toast";
import {
  DEFAULT_PICKUP_OPTION_A,
  DEFAULT_PICKUP_OPTION_B,
  validatePickupOptionLabels,
} from "@/lib/pickup-options";
import { formatCurrency } from "@/lib/utils";
import type { Round } from "@/types";

export function RoundsPageClient({ initialRounds }: { initialRounds: Round[] }) {
  const router = useRouter();
  const { adminFetch } = useAdminFetch();
  const { toast } = useToast();
  const [rounds, setRounds] = useState(initialRounds);

  const [editingFee, setEditingFee] = useState(false);
  const [feeInput, setFeeInput] = useState("");
  const [editingDeadline, setEditingDeadline] = useState(false);
  const [deadlineInput, setDeadlineInput] = useState("");
  const [editingPickupOptions, setEditingPickupOptions] = useState(false);
  const [pickupOptionAInput, setPickupOptionAInput] = useState("");
  const [pickupOptionBInput, setPickupOptionBInput] = useState("");

  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDeadline, setNewDeadline] = useState("");
  const [newFee, setNewFee] = useState("");
  const [newPickupOptionA, setNewPickupOptionA] = useState(
    DEFAULT_PICKUP_OPTION_A,
  );
  const [newPickupOptionB, setNewPickupOptionB] = useState(
    DEFAULT_PICKUP_OPTION_B,
  );
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    setRounds(initialRounds);
  }, [initialRounds]);

  const currentRound = rounds.find((round) => round.is_open);
  const pastRounds = rounds.filter((round) => !round.is_open).slice(0, 5);

  async function updateRound(
    id: string,
    fields: Record<string, unknown>,
    message: string,
  ) {
    try {
      await adminFetch("/api/rounds", {
        method: "PUT",
        body: JSON.stringify({ id, ...fields }),
      });
      toast({ title: message });
      router.refresh();
    } catch {
      toast({ title: "操作失敗", variant: "destructive" });
    }
  }

  function resetNewRoundForm() {
    setShowNewForm(false);
    setNewName("");
    setNewDeadline("");
    setNewFee("");
    setNewPickupOptionA(DEFAULT_PICKUP_OPTION_A);
    setNewPickupOptionB(DEFAULT_PICKUP_OPTION_B);
  }

  async function createRound(event: React.FormEvent) {
    event.preventDefault();
    if (!newName.trim()) return;

    const pickupOptions = validatePickupOptionLabels(
      newPickupOptionA,
      newPickupOptionB,
    );
    if (!pickupOptions.ok) {
      toast({ title: pickupOptions.error, variant: "destructive" });
      return;
    }

    setCreating(true);
    try {
      await adminFetch("/api/rounds", {
        method: "POST",
        body: JSON.stringify({
          name: newName.trim(),
          deadline: newDeadline ? new Date(newDeadline).toISOString() : null,
          shipping_fee: newFee ? parseInt(newFee, 10) : null,
          pickup_option_a: pickupOptions.pickup_option_a,
          pickup_option_b: pickupOptions.pickup_option_b,
        }),
      });
      toast({ title: "新團已建立" });
      resetNewRoundForm();
      router.refresh();
    } catch {
      toast({ title: "建立失敗", variant: "destructive" });
    } finally {
      setCreating(false);
    }
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
            調整本輪截止時間、宅配運費、面交點，或建立下一輪團購。
          </p>
        </div>
      </section>

      {currentRound ? (
        <div className="lux-panel p-5 space-y-4">
          <div className="flex justify-between items-start">
            <div>
              <div className="font-display text-2xl text-[hsl(var(--ink))]">
                {currentRound.name}
              </div>

              {editingDeadline ? (
                <div className="mt-1 flex items-center gap-1.5">
                  <input
                    type="datetime-local"
                    value={deadlineInput}
                    onChange={(event) => setDeadlineInput(event.target.value)}
                    className="lux-input"
                    autoFocus
                  />
                  <button
                    onClick={() => {
                      if (!deadlineInput) return;
                      void updateRound(
                        currentRound.id,
                        { deadline: new Date(deadlineInput).toISOString() },
                        "截止時間已更新",
                      );
                      setEditingDeadline(false);
                    }}
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

              <div className="mt-1 flex items-center gap-2">
                <span className="text-xs text-[rgb(74,96,136)]">宅配運費：</span>
                {editingFee ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">
                      $
                    </span>
                    <input
                      type="number"
                      min="0"
                      value={feeInput}
                      onChange={(event) => setFeeInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Escape") setEditingFee(false);
                        if (event.key === "Enter") {
                          const value = parseInt(feeInput, 10);
                          if (!Number.isNaN(value) && value >= 0) {
                            void updateRound(
                              currentRound.id,
                              { shipping_fee: value },
                              "運費已更新",
                            );
                            setEditingFee(false);
                          }
                        }
                      }}
                      className="lux-input w-24 font-semibold"
                      autoFocus
                    />
                    <button
                      onClick={() => {
                        const value = parseInt(feeInput, 10);
                        if (Number.isNaN(value) || value < 0) {
                          toast({ title: "請輸入有效金額", variant: "destructive" });
                          return;
                        }
                        void updateRound(
                          currentRound.id,
                          { shipping_fee: value },
                          "運費已更新",
                        );
                        setEditingFee(false);
                      }}
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
                        setFeeInput(
                          currentRound.shipping_fee != null
                            ? String(currentRound.shipping_fee)
                            : "0",
                        );
                        setEditingFee(true);
                      }}
                      className="text-xs text-[hsl(var(--muted-foreground))]"
                    >
                      編輯
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">
                面交點：
                {editingPickupOptions ? (
                  <div className="mt-2 space-y-2">
                    <input
                      value={pickupOptionAInput}
                      onChange={(event) =>
                        setPickupOptionAInput(event.target.value)
                      }
                      className="lux-input"
                      placeholder="面交點 A"
                    />
                    <input
                      value={pickupOptionBInput}
                      onChange={(event) =>
                        setPickupOptionBInput(event.target.value)
                      }
                      className="lux-input"
                      placeholder="面交點 B"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          const pickupOptions = validatePickupOptionLabels(
                            pickupOptionAInput,
                            pickupOptionBInput,
                          );
                          if (!pickupOptions.ok) {
                            toast({
                              title: pickupOptions.error,
                              variant: "destructive",
                            });
                            return;
                          }
                          void updateRound(
                            currentRound.id,
                            {
                              pickup_option_a: pickupOptions.pickup_option_a,
                              pickup_option_b: pickupOptions.pickup_option_b,
                            },
                            "面交點已更新",
                          );
                          setEditingPickupOptions(false);
                        }}
                        className="rounded-full bg-[rgb(74,96,136)] px-3 py-1.5 text-xs font-semibold text-white"
                      >
                        儲存
                      </button>
                      <button
                        onClick={() => setEditingPickupOptions(false)}
                        className="text-xs text-[hsl(var(--muted-foreground))]"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                ) : (
                  <span>
                    {" "}
                    {currentRound.pickup_option_a} / {currentRound.pickup_option_b}
                    <button
                      onClick={() => {
                        setPickupOptionAInput(currentRound.pickup_option_a);
                        setPickupOptionBInput(currentRound.pickup_option_b);
                        setEditingPickupOptions(true);
                      }}
                      className="ml-2 text-xs text-[hsl(var(--muted-foreground))]"
                    >
                      編輯
                    </button>
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  setDeadlineInput(
                    currentRound.deadline
                      ? new Date(currentRound.deadline).toISOString().slice(0, 16)
                      : "",
                  );
                  setEditingDeadline(true);
                }}
                className="rounded-full border border-[rgba(177,140,92,0.24)] px-4 py-2 text-xs font-medium text-[hsl(var(--ink))]"
              >
                改截止
              </button>
              <button
                onClick={() =>
                  void updateRound(currentRound.id, { is_open: false }, "已截單")
                }
                className="rounded-full bg-[rgb(140,67,56)] px-4 py-2 text-xs font-semibold text-white"
              >
                截單
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="lux-panel p-5 text-sm text-[hsl(var(--muted-foreground))]">
          目前沒有開啟中的團購，可直接建立新團。
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={() => setShowNewForm((current) => !current)}
          className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-[hsl(var(--forest))] px-5 py-2.5 text-sm font-semibold text-[hsl(var(--mist))]"
        >
          {showNewForm ? "收起表單" : "建立新團"}
        </button>
      </div>

      {showNewForm && (
        <form onSubmit={createRound} className="lux-panel space-y-3 p-5">
          <input
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder="團購名稱"
            className="lux-input"
            required
          />
          <input
            type="datetime-local"
            value={newDeadline}
            onChange={(event) => setNewDeadline(event.target.value)}
            className="lux-input"
          />
          <input
            type="number"
            min="0"
            value={newFee}
            onChange={(event) => setNewFee(event.target.value)}
            placeholder="宅配運費"
            className="lux-input"
          />
          <input
            value={newPickupOptionA}
            onChange={(event) => setNewPickupOptionA(event.target.value)}
            className="lux-input"
          />
          <input
            value={newPickupOptionB}
            onChange={(event) => setNewPickupOptionB(event.target.value)}
            className="lux-input"
          />
          <button
            type="submit"
            disabled={creating}
            className="rounded-full bg-[hsl(var(--forest))] px-5 py-2.5 text-sm font-semibold text-[hsl(var(--mist))] disabled:opacity-50"
          >
            {creating ? "建立中…" : "建立新團"}
          </button>
        </form>
      )}

      {pastRounds.length > 0 && (
        <div className="lux-panel p-5 space-y-2">
          <div className="lux-kicker">Recent Closed Rounds</div>
          {pastRounds.map((round) => (
            <div
              key={round.id}
              className="flex items-center justify-between rounded-[1rem] border border-[rgba(177,140,92,0.14)] bg-[rgba(255,251,246,0.72)] px-4 py-3 text-sm"
            >
              <div>
                <div className="font-medium text-[hsl(var(--ink))]">{round.name}</div>
                <div className="text-xs text-[hsl(var(--muted-foreground))]">
                  {new Date(round.created_at).toLocaleString("zh-TW")}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
