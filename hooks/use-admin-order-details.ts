"use client";

import { useCallback, useRef, useState } from "react";
import type { AdminOrderDetail } from "@/types";

export function useAdminOrderDetails(
  adminFetch: <T = unknown>(url: string, options?: RequestInit) => Promise<T>,
) {
  const [detailsById, setDetailsById] = useState<Record<string, AdminOrderDetail>>(
    {},
  );
  const [loadingDetailIds, setLoadingDetailIds] = useState<Set<string>>(
    new Set(),
  );
  const detailsRef = useRef<Record<string, AdminOrderDetail>>({});
  const requestsRef = useRef<Record<string, Promise<AdminOrderDetail>>>({});

  const loadOrderDetail = useCallback(
    async (orderId: string): Promise<AdminOrderDetail> => {
      const existing = detailsRef.current[orderId];
      if (existing) {
        return existing;
      }

      const pendingRequest = requestsRef.current[orderId];
      if (pendingRequest) {
        return pendingRequest;
      }

      setLoadingDetailIds((current) => {
        const next = new Set(current);
        next.add(orderId);
        return next;
      });

      const request = adminFetch<{ order: AdminOrderDetail }>(
        `/api/orders/${orderId}`,
      )
        .then(({ order }) => {
          detailsRef.current = {
            ...detailsRef.current,
            [orderId]: order,
          };
          setDetailsById(detailsRef.current);
          return order;
        })
        .finally(() => {
          delete requestsRef.current[orderId];
          setLoadingDetailIds((current) => {
            if (!current.has(orderId)) {
              return current;
            }
            const next = new Set(current);
            next.delete(orderId);
            return next;
          });
        });

      requestsRef.current[orderId] = request;
      return request;
    },
    [adminFetch],
  );

  const setOrderDetail = useCallback((order: AdminOrderDetail) => {
    detailsRef.current = {
      ...detailsRef.current,
      [order.id]: order,
    };
    setDetailsById(detailsRef.current);
  }, []);

  const removeOrderDetails = useCallback((orderIds: string[]) => {
    if (orderIds.length === 0) {
      return;
    }

    const nextDetails = { ...detailsRef.current };
    let changed = false;

    for (const orderId of orderIds) {
      if (orderId in nextDetails) {
        delete nextDetails[orderId];
        changed = true;
      }
    }

    if (!changed) {
      return;
    }

    detailsRef.current = nextDetails;
    setDetailsById(nextDetails);
  }, []);

  return {
    detailsById,
    loadingDetailIds,
    loadOrderDetail,
    setOrderDetail,
    removeOrderDetails,
  };
}
