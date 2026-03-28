import type { Round as DbRound } from "@prisma/client";
import type { AdminOrderListRow, ProductWithProgress, Round } from "@/types";

const FIXTURE_ROUND: Round = {
  id: "round-playwright",
  name: "Playwright 測試團",
  is_open: true,
  deadline: "2026-04-01T12:00:00.000Z",
  shipping_fee: 60,
  pickup_option_a: "面交點 A",
  pickup_option_b: "面交點 B",
  created_at: "2026-03-25T00:00:00.000Z",
};

const FIXTURE_DB_ROUND: DbRound = {
  ...FIXTURE_ROUND,
  deadline: FIXTURE_ROUND.deadline
    ? new Date(FIXTURE_ROUND.deadline)
    : null,
  created_at: new Date(FIXTURE_ROUND.created_at),
};

const FIXTURE_PRODUCTS: ProductWithProgress[] = [
  {
    id: "product-playwright-1",
    round_id: FIXTURE_ROUND.id,
    supplier_id: null,
    name: "地瓜",
    price: 120,
    unit: "袋",
    is_active: true,
    stock: 20,
    goal_qty: 10,
    image_url: null,
    created_at: "2026-03-25T00:00:00.000Z",
    supplier_name: null,
    current_qty: 6,
    progress_pct: 60,
  },
];

const FIXTURE_ORDER_ROWS: AdminOrderListRow[] = [
  {
    id: "order-playwright-pending",
    order_number: "ORD-PLAYWRIGHT-001",
    round_id: FIXTURE_ROUND.id,
    total_amount: 300,
    shipping_fee: 60,
    status: "pending_confirm",
    payment_amount: 300,
    payment_last5: "12345",
    payment_reported_at: "2026-03-25T09:00:00.000Z",
    confirmed_at: null,
    shipped_at: null,
    pickup_location: null,
    created_at: "2026-03-25T08:00:00.000Z",
    items_preview: "地瓜 ×2",
    user: {
      nickname: "測試客戶",
      purchaser_name: "王小美",
      recipient_name: "王小美",
      phone: "0912-345-678",
    },
  },
  {
    id: "order-playwright-confirmed",
    order_number: "ORD-PLAYWRIGHT-002",
    round_id: FIXTURE_ROUND.id,
    total_amount: 240,
    shipping_fee: null,
    status: "confirmed",
    payment_amount: 240,
    payment_last5: "67890",
    payment_reported_at: "2026-03-25T10:00:00.000Z",
    confirmed_at: "2026-03-25T10:30:00.000Z",
    shipped_at: null,
    pickup_location: "面交點 A",
    created_at: "2026-03-25T09:30:00.000Z",
    items_preview: "地瓜 ×2",
    user: {
      nickname: "面交客戶",
      purchaser_name: "陳大華",
      recipient_name: "陳大華",
      phone: "0922-000-111",
    },
  },
];

export function isPlaywrightAdminFixtureEnabled() {
  return process.env.PLAYWRIGHT_ADMIN_FIXTURE === "1";
}

export function getPlaywrightAdminChromeFixture() {
  return {
    round: FIXTURE_DB_ROUND,
    rounds: [FIXTURE_DB_ROUND],
    pendingCount: 1,
  };
}

export function getPlaywrightOrdersPageFixture(input: {
  status: string;
  search: string;
}) {
  const searchTerm = input.search.trim().toLowerCase();
  const filtered = FIXTURE_ORDER_ROWS.filter((order) => {
    if (input.status !== "all" && order.status !== input.status) {
      return false;
    }

    if (!searchTerm) {
      return true;
    }

    const haystack = [
      order.order_number,
      order.user?.nickname,
      order.user?.purchaser_name,
      order.user?.recipient_name,
      order.user?.phone,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(searchTerm);
  });

  return {
    round: FIXTURE_ROUND,
    products: FIXTURE_PRODUCTS,
    ordersPage: {
      items: filtered,
      total: filtered.length,
      page: 1,
      pageSize: 50,
      hasMore: false,
    },
  };
}

export function getPlaywrightShipmentsPageFixture(input: {
  search: string;
  productId?: string;
}) {
  const searchTerm = input.search.trim().toLowerCase();
  const filtered = FIXTURE_ORDER_ROWS.filter((order) => {
    if (order.status !== "confirmed") {
      return false;
    }

    if (input.productId && input.productId !== FIXTURE_PRODUCTS[0]?.id) {
      return false;
    }

    if (!searchTerm) {
      return true;
    }

    const haystack = [
      order.order_number,
      order.user?.nickname,
      order.user?.purchaser_name,
      order.user?.recipient_name,
      order.user?.phone,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(searchTerm);
  });

  return {
    round: FIXTURE_ROUND,
    ordersPage: {
      items: filtered,
      total: filtered.length,
      page: 1,
      pageSize: 50,
      hasMore: false,
    },
  };
}

export function getPlaywrightStorefrontFixture() {
  return {
    round: FIXTURE_ROUND,
    products: FIXTURE_PRODUCTS,
  };
}
