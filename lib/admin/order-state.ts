import type { OrderStatus } from "@/types";

interface HasId {
  id: string;
}

interface HasStatus extends HasId {
  status: OrderStatus;
}

interface BatchStatusTransitionOptions<T extends HasStatus> {
  ids: string[];
  skippedIds?: string[];
  fromStatus: OrderStatus;
  toStatus: OrderStatus;
  patch?: (item: T) => T;
}

export function replaceItemById<T extends HasId>(items: T[], nextItem: T): T[] {
  return items.map((item) => (item.id === nextItem.id ? nextItem : item));
}

export function removeItemsById<T extends HasId>(items: T[], ids: string[]): T[] {
  const removedIds = new Set(ids);
  return items.filter((item) => !removedIds.has(item.id));
}

export function removeBatchItemsById<T extends HasId>(
  items: T[],
  ids: string[],
  skippedIds: string[] = [],
): T[] {
  const targetIds = new Set(ids);
  const skippedIdSet = new Set(skippedIds);

  return items.filter(
    (item) => !targetIds.has(item.id) || skippedIdSet.has(item.id),
  );
}

export function applyBatchStatusTransition<T extends HasStatus>(
  items: T[],
  { ids, skippedIds = [], fromStatus, toStatus, patch }: BatchStatusTransitionOptions<T>,
): T[] {
  const targetIds = new Set(ids);
  const skippedIdSet = new Set(skippedIds);

  return items.map((item) => {
    if (!targetIds.has(item.id) || skippedIdSet.has(item.id) || item.status !== fromStatus) {
      return item;
    }

    const nextItem = { ...item, status: toStatus } as T;
    return patch ? patch(nextItem) : nextItem;
  });
}

export function getPendingConfirmCountDelta(
  previousStatus: OrderStatus,
  nextStatus: OrderStatus,
): number {
  if (previousStatus === "pending_confirm" && nextStatus !== "pending_confirm") {
    return -1;
  }

  if (previousStatus !== "pending_confirm" && nextStatus === "pending_confirm") {
    return 1;
  }

  return 0;
}

export function applyPendingCountDelta(currentCount: number, delta: number): number {
  return Math.max(0, currentCount + delta);
}
