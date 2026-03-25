import { beforeEach, describe, expect, it, vi } from "vitest";

const ordersMock = vi.hoisted(() => ({
  getRoundOrderStatusCounts: vi.fn(),
  getRoundProductDemand: vi.fn(),
  getRoundRevenueTotal: vi.fn(),
}));
vi.mock("@/lib/db/orders", () => ordersMock);

const productsMock = vi.hoisted(() => ({
  listDashboardByRound: vi.fn(),
}));
vi.mock("@/lib/db/products", () => productsMock);

const notificationLogsMock = vi.hoisted(() => ({
  getNotificationSummaryByRound: vi.fn(),
}));
vi.mock("@/lib/db/notification-logs", () => notificationLogsMock);

import { getAdminDashboardSummary } from "./dashboard";

describe("getAdminDashboardSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns aggregated dashboard stats, product rows, and notification summary", async () => {
    ordersMock.getRoundOrderStatusCounts.mockResolvedValue([
      { status: "pending_confirm", _count: { _all: 2 } },
      { status: "confirmed", _count: { _all: 1 } },
      { status: "cancelled", _count: { _all: 1 } },
    ]);
    ordersMock.getRoundRevenueTotal.mockResolvedValue(1280);
    ordersMock.getRoundProductDemand.mockResolvedValue([
      {
        product_id: "p1",
        product_name: "地瓜",
        _sum: { quantity: 4, subtotal: 800 },
      },
      {
        product_id: "orphan-product",
        product_name: "雞蛋",
        _sum: { quantity: 2, subtotal: 480 },
      },
    ]);
    productsMock.listDashboardByRound.mockResolvedValue([
      {
        id: "p1",
        name: "地瓜",
        unit: "箱",
        supplier: { name: "阿甘農場" },
      },
      {
        id: "p2",
        name: "玉米",
        unit: "支",
        supplier: null,
      },
    ]);
    notificationLogsMock.getNotificationSummaryByRound.mockResolvedValue([
      {
        type: "shipment",
        channel: "line",
        status: "success",
        _count: { _all: 3 },
      },
      {
        type: "shipment",
        channel: "email",
        status: "failed",
        _count: { _all: 1 },
      },
    ]);

    const summary = await getAdminDashboardSummary("r1");

    expect(summary.counts.pending_confirm).toBe(2);
    expect(summary.totalOrders).toBe(4);
    expect(summary.activeOrders).toBe(3);
    expect(summary.totalRevenue).toBe(1280);
    expect(summary.productRows).toEqual([
      {
        productId: "p1",
        name: "地瓜",
        supplierName: "阿甘農場",
        unit: "箱",
        qty: 4,
        revenue: 800,
      },
      {
        productId: "p2",
        name: "玉米",
        supplierName: null,
        unit: "支",
        qty: 0,
        revenue: 0,
      },
      {
        productId: "orphan-product",
        name: "雞蛋",
        supplierName: null,
        unit: "份",
        qty: 2,
        revenue: 480,
      },
    ]);
    expect(summary.notificationSummary).toEqual([
      {
        type: "shipment",
        line: { success: 3, failed: 0, skipped: 0 },
        email: { success: 0, failed: 1, skipped: 0 },
      },
    ]);
  });
});
