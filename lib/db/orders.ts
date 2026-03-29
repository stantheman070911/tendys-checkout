import { Prisma } from "@prisma/client";
import { toAdminOrderListRow } from "@/lib/admin/order-view";
import { prisma } from "@/lib/db/prisma";
import { decrementStock, restoreStock } from "@/lib/db/products";
import {
  enqueueOrderCancelledNotificationsTx,
  enqueuePaymentConfirmedNotificationsTx,
  enqueueShipmentNotificationsTx,
} from "@/lib/notifications/outbox";
import { isValidRoundPickupLocation } from "@/lib/pickup-options";
import { normalizePhoneDigits } from "@/lib/utils";
import type { AdminOrderListRow } from "@/types";

type TxClient = Omit<
  typeof prisma,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

const orderWithItemsInclude = {
  order_items: true,
} as const satisfies Prisma.OrderInclude;

const orderWithRelationsInclude = {
  order_items: true,
  user: true,
  round: true,
} as const satisfies Prisma.OrderInclude;

const orderWithAdminExportInclude = {
  order_items: true,
  user: true,
} as const satisfies Prisma.OrderInclude;

const orderWithAdminListSelect = {
  id: true,
  order_number: true,
  round_id: true,
  total_amount: true,
  shipping_fee: true,
  status: true,
  payment_amount: true,
  payment_last5: true,
  payment_reported_at: true,
  confirmed_at: true,
  shipped_at: true,
  pickup_location: true,
  created_at: true,
  user: {
    select: {
      nickname: true,
      purchaser_name: true,
      recipient_name: true,
      phone: true,
    },
  },
  order_items: {
    select: {
      product_name: true,
      quantity: true,
    },
    orderBy: {
      id: "asc",
    },
  },
} as const satisfies Prisma.OrderSelect;

type OrderWithItems = Prisma.OrderGetPayload<{
  include: typeof orderWithItemsInclude;
}>;

type OrderWithRelations = Prisma.OrderGetPayload<{
  include: typeof orderWithRelationsInclude;
}>;

type OrderWithAdminListRelations = Prisma.OrderGetPayload<{
  select: typeof orderWithAdminListSelect;
}>;

type AdminOrderListQueryRow = {
  id: string;
  order_number: string;
  round_id: string | null;
  total_amount: number;
  shipping_fee: number | null;
  status: string;
  payment_amount: number | null;
  payment_last5: string | null;
  payment_reported_at: Date | null;
  confirmed_at: Date | null;
  shipped_at: Date | null;
  pickup_location: string | null;
  created_at: Date;
  items_preview: string | null;
  user_nickname: string | null;
  user_purchaser_name: string | null;
  user_recipient_name: string | null;
  user_phone: string | null;
};

type CheckoutUserRecord = {
  id: string;
  nickname: string;
  purchaser_name: string | null;
  recipient_name: string | null;
  phone: string | null;
  address: string | null;
  email: string | null;
};

interface CheckoutUserInput {
  nickname: string;
  purchaser_name: string;
  recipient_name: string;
  phone: string;
  address?: string;
  email?: string;
}

interface CreateOrderData {
  round_id: string;
  user_id: string;
  pickup_location: string;
  note?: string;
}

interface CreateOrderItem {
  product_id: string;
  quantity: number;
}

function sortByProductId<T extends { product_id: string | null }>(items: T[]) {
  return [...items].sort((left, right) =>
    (left.product_id ?? "").localeCompare(right.product_id ?? ""),
  );
}

export interface PaginatedOrdersResult {
  items: AdminOrderListRow[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface CreateCheckoutOrderInput {
  round_id: string;
  pickup_location: string;
  note?: string;
  submission_key: string;
  items: CreateOrderItem[];
  is_admin: boolean;
  save_profile: boolean;
  user: CheckoutUserInput;
}

export type CreateCheckoutOrderResult =
  | {
      kind: "success";
      order: OrderWithItems;
      deduplicated: boolean;
    }
  | {
      kind: "validation_error";
      error: string;
    }
  | {
      kind: "saved_profile_phone_mismatch";
    }
  | {
      kind: "schema_drift_access_code";
      error: string;
    };

type CreateWithItemsResult =
  | {
      order: OrderWithItems;
      deduplicated: boolean;
    }
  | {
      error: string;
    };

type SaveCheckoutProfileResult =
  | {
      kind: "success";
    }
  | {
      kind: "saved_profile_phone_mismatch";
    };

// Thrown inside $transaction to trigger rollback while carrying a user-facing message
class OrderValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrderValidationError";
  }
}

function normalizePersonName(value: string | null | undefined): string {
  return (value ?? "").trim().toLocaleLowerCase();
}

function buildNormalizedUserLookupFields(input: {
  purchaser_name: string | null | undefined;
  phone: string | null | undefined;
}) {
  const phoneDigits = normalizePhoneDigits(input.phone);

  return {
    purchaser_name_lower: normalizePersonName(input.purchaser_name),
    phone_digits: phoneDigits,
    phone_last3: phoneDigits.length >= 3 ? phoneDigits.slice(-3) : "",
  };
}

function buildLogicalCustomerIdentityKey(order: {
  id: string;
  user?: {
    purchaser_name?: string | null;
    recipient_name?: string | null;
    phone?: string | null;
  } | null;
}): string {
  const normalizedName =
    normalizePersonName(order.user?.purchaser_name) ||
    normalizePersonName(order.user?.recipient_name);
  const normalizedPhone = normalizePhoneDigits(order.user?.phone);

  if (!normalizedName || !normalizedPhone) {
    return order.id;
  }

  return `${normalizedName}|${normalizedPhone}`;
}

function orderMatchesPublicIdentity(
  order: {
    user?: {
      purchaser_name?: string | null;
      phone?: string | null;
    } | null;
  },
  purchaserName: string,
  phoneLast3: string,
): boolean {
  return (
    normalizePersonName(order.user?.purchaser_name) ===
      normalizePersonName(purchaserName) &&
    normalizePhoneDigits(order.user?.phone).endsWith(phoneLast3)
  );
}

function phoneMatchesExact(
  existingPhone: string | null | undefined,
  nextPhone: string | null | undefined,
): boolean {
  const existingDigits = normalizePhoneDigits(existingPhone);
  const nextDigits = normalizePhoneDigits(nextPhone);
  return !!existingDigits && existingDigits === nextDigits;
}

function errorMetaIncludesField(value: unknown, field: string): boolean {
  if (typeof value === "string") return value.includes(field);
  if (Array.isArray(value)) {
    return value.some((entry) => errorMetaIncludesField(entry, field));
  }
  if (value && typeof value === "object") {
    return Object.values(value).some((entry) =>
      errorMetaIncludesField(entry, field),
    );
  }
  return false;
}

function isSchemaDriftAccessCodeError(
  error: unknown,
): error is Prisma.PrismaClientKnownRequestError {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2011" &&
    errorMetaIncludesField(error.meta, "access_code")
  );
}

function isUniqueConstraintError(
  error: unknown,
): error is Prisma.PrismaClientKnownRequestError {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

async function findBySubmissionKeyTx(
  tx: TxClient,
  key: string,
): Promise<OrderWithItems | null> {
  return tx.order.findUnique({
    where: { submission_key: key },
    include: orderWithItemsInclude,
  });
}

async function acquireSavedProfileLock(tx: TxClient, nickname: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${nickname}))`;
}

async function createUserSnapshot(
  tx: TxClient,
  data: CheckoutUserInput,
): Promise<CheckoutUserRecord> {
  return tx.user.create({
    data: {
      nickname: data.nickname,
      purchaser_name: data.purchaser_name,
      ...buildNormalizedUserLookupFields(data),
      recipient_name: data.recipient_name,
      phone: data.phone,
      address: data.address ?? null,
      email: data.email ?? null,
    },
  });
}

async function saveCheckoutProfileInTx(
  tx: TxClient,
  input: CheckoutUserInput,
): Promise<SaveCheckoutProfileResult> {
  await acquireSavedProfileLock(tx, input.nickname);

  const existingProfile = await tx.savedCheckoutProfile.findUnique({
    where: { nickname: input.nickname },
  });

  if (existingProfile && !phoneMatchesExact(existingProfile.phone, input.phone)) {
    return { kind: "saved_profile_phone_mismatch" };
  }

  const profileData = {
    purchaser_name: input.purchaser_name,
    recipient_name: input.recipient_name,
    phone: input.phone,
    address: input.address ?? null,
    email: input.email ?? null,
    updated_at: new Date(),
  };

  if (existingProfile) {
    await tx.savedCheckoutProfile.update({
      where: { nickname: input.nickname },
      data: profileData,
    });
    return { kind: "success" };
  }

  await tx.savedCheckoutProfile.create({
    data: {
      nickname: input.nickname,
      ...profileData,
      created_at: new Date(),
    },
  });
  return { kind: "success" };
}

async function createOrderInTx(
  tx: TxClient,
  data: CreateOrderData,
  items: CreateOrderItem[],
  submissionKey: string,
): Promise<OrderWithItems> {
  const round = await tx.round.findUnique({
    where: { id: data.round_id },
  });
  if (!round || !round.is_open) {
    throw new OrderValidationError("Round is not open");
  }
  if (round.deadline && new Date() > new Date(round.deadline)) {
    throw new OrderValidationError("This round has closed");
  }
  if (!isValidRoundPickupLocation(round, data.pickup_location)) {
    throw new OrderValidationError("Invalid pickup_location for this round");
  }

  const canonicalProducts = await tx.product.findMany({
    where: { id: { in: items.map((item) => item.product_id) } },
  });
  const productMap = new Map(canonicalProducts.map((product) => [product.id, product]));

  for (const item of items) {
    const product = productMap.get(item.product_id);
    if (!product) {
      throw new OrderValidationError(`Product not found: ${item.product_id}`);
    }
    if (product.round_id !== data.round_id) {
      throw new OrderValidationError(
        `Product ${product.name} does not belong to this round`,
      );
    }
    if (!product.is_active) {
      throw new OrderValidationError(
        `Product ${product.name} is no longer available`,
      );
    }
  }

  const resolvedItems = [];
  let itemsTotal = 0;
  const sortedItems = sortByProductId(items);

  for (const item of sortedItems) {
    const product = productMap.get(item.product_id)!;

    const stockReserved = await decrementStock(item.product_id, item.quantity, tx);
    if (!stockReserved) {
      throw new OrderValidationError(`Insufficient stock for ${product.name}`);
    }

    const subtotal = product.price * item.quantity;
    itemsTotal += subtotal;
    resolvedItems.push({
      product_id: product.id,
      product_name: product.name,
      unit_price: product.price,
      quantity: item.quantity,
      subtotal,
    });
  }

  const isDelivery = !data.pickup_location;
  const shippingFee = isDelivery ? round.shipping_fee : null;
  const totalAmount = itemsTotal + (shippingFee ?? 0);

  return tx.order.create({
    data: {
      user_id: data.user_id,
      round_id: data.round_id,
      total_amount: totalAmount,
      shipping_fee: shippingFee,
      pickup_location: data.pickup_location || null,
      note: data.note || null,
      submission_key: submissionKey,
      order_items: {
        create: resolvedItems,
      },
    },
    include: orderWithItemsInclude,
  });
}

export async function createWithItems(
  data: CreateOrderData,
  items: CreateOrderItem[],
  submissionKey: string,
): Promise<CreateWithItemsResult> {
  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await findBySubmissionKeyTx(tx, submissionKey);
      if (existing) return { order: existing, deduplicated: true };

      const order = await createOrderInTx(tx, data, items, submissionKey);
      return { order, deduplicated: false };
    });
  } catch (err) {
    if (err instanceof OrderValidationError) {
      return { error: err.message };
    }
    if (isUniqueConstraintError(err)) {
      const existing = await findBySubmissionKey(submissionKey);
      if (existing) return { order: existing, deduplicated: true };
    }
    throw err;
  }
}

export async function createCheckoutOrder(
  input: CreateCheckoutOrderInput,
): Promise<CreateCheckoutOrderResult> {
  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await findBySubmissionKeyTx(tx, input.submission_key);
      if (existing) {
        return {
          kind: "success",
          order: existing,
          deduplicated: true,
        };
      }

      if (!input.is_admin && input.save_profile) {
        const savedProfileResult = await saveCheckoutProfileInTx(tx, input.user);
        if (savedProfileResult.kind === "saved_profile_phone_mismatch") {
          return savedProfileResult;
        }
      }

      const snapshotUser = await createUserSnapshot(tx, input.user);

      const order = await createOrderInTx(
        tx,
        {
          round_id: input.round_id,
          user_id: snapshotUser.id,
          pickup_location: input.pickup_location,
          note: input.note,
        },
        input.items,
        input.submission_key,
      );

      return {
        kind: "success",
        order,
        deduplicated: false,
      };
    });
  } catch (error) {
    if (error instanceof OrderValidationError) {
      return { kind: "validation_error", error: error.message };
    }
    if (isSchemaDriftAccessCodeError(error)) {
      return {
        kind: "schema_drift_access_code",
        error:
          "Order creation is temporarily unavailable because the database is missing migration_007_remove_access_code.sql.",
      };
    }
    if (isUniqueConstraintError(error)) {
      const existing = await findBySubmissionKey(input.submission_key);
      if (existing) {
        return {
          kind: "success",
          order: existing,
          deduplicated: true,
        };
      }
    }
    throw error;
  }
}

// ─── Query ───────────────────────────────────────────────────

export async function findBySubmissionKey(
  key: string,
): Promise<OrderWithItems | null> {
  return prisma.order.findUnique({
    where: { submission_key: key },
    include: orderWithItemsInclude,
  });
}

export async function getOrderWithItems(
  orderId: string,
): Promise<OrderWithRelations | null> {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: orderWithRelationsInclude,
  });
}

export async function getConfirmedShipmentPrintOrdersByIds(
  roundId: string,
  orderIds: string[],
) {
  const orders = await prisma.order.findMany({
    where: {
      id: { in: orderIds },
      round_id: roundId,
      status: "confirmed",
    },
    include: orderWithAdminExportInclude,
  });

  const orderById = new Map(orders.map((order) => [order.id, order]));
  return orderIds
    .map((orderId) => orderById.get(orderId))
    .filter((order): order is NonNullable<typeof order> => !!order);
}

export async function findOrdersByPurchaserNameAndPhoneLast3(
  purchaserName: string,
  phoneLast3: string,
): Promise<OrderWithRelations[]> {
  return prisma.order.findMany({
    where: {
      user: {
        is: {
          purchaser_name_lower: normalizePersonName(purchaserName),
          phone_last3: phoneLast3,
        },
      },
    },
    include: orderWithRelationsInclude,
    orderBy: { created_at: "desc" },
  });
}

export async function findPublicOrderByOrderNumberAndIdentity(
  orderNumber: string,
  purchaserName: string,
  phoneLast3: string,
): Promise<OrderWithRelations | null> {
  return prisma.order.findFirst({
    where: {
      order_number: orderNumber,
      user: {
        is: {
          purchaser_name_lower: normalizePersonName(purchaserName),
          phone_last3: phoneLast3,
        },
      },
    },
    include: orderWithRelationsInclude,
  });
}

function buildAdminOrderWhere(input: {
  roundId: string;
  status?: string;
  search?: string;
  productId?: string;
}): Prisma.OrderWhereInput {
  const trimmedSearch = input.search?.trim();
  const where: Prisma.OrderWhereInput = {
    round_id: input.roundId,
    ...(input.status ? { status: input.status } : {}),
  };

  if (input.productId) {
    where.order_items = {
      some: {
        product_id: input.productId,
      },
    };
  }

  if (trimmedSearch) {
    where.OR = [
      {
        order_number: {
          contains: trimmedSearch,
          mode: "insensitive",
        },
      },
      {
        user: {
          is: {
            nickname: {
              contains: trimmedSearch,
              mode: "insensitive",
            },
          },
        },
      },
      {
        user: {
          is: {
            purchaser_name: {
              contains: trimmedSearch,
              mode: "insensitive",
            },
          },
        },
      },
      {
        user: {
          is: {
            recipient_name: {
              contains: trimmedSearch,
              mode: "insensitive",
            },
          },
        },
      },
      {
        user: {
          is: {
            phone: {
              contains: trimmedSearch,
            },
          },
        },
      },
    ];
  }

  return where;
}

export async function listPageByRound(input: {
  roundId: string;
  status?: string;
  search?: string;
  productId?: string;
  page?: number;
  pageSize?: number;
}): Promise<PaginatedOrdersResult> {
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, input.pageSize ?? 50));
  const where = buildAdminOrderWhere(input);
  const searchTerm = input.search?.trim();
  const conditions: Prisma.Sql[] = [Prisma.sql`o.round_id = ${input.roundId}::uuid`];

  if (input.status) {
    conditions.push(Prisma.sql`o.status = ${input.status}`);
  }

  if (input.productId) {
    conditions.push(Prisma.sql`
      EXISTS (
        SELECT 1
        FROM order_items oi_filter
        WHERE oi_filter.order_id = o.id
          AND oi_filter.product_id = ${input.productId}::uuid
      )
    `);
  }

  if (searchTerm) {
    const searchLike = `%${searchTerm}%`;
    conditions.push(Prisma.sql`
      (
        o.order_number ILIKE ${searchLike}
        OR COALESCE(u.nickname, '') ILIKE ${searchLike}
        OR COALESCE(u.purchaser_name, '') ILIKE ${searchLike}
        OR COALESCE(u.recipient_name, '') ILIKE ${searchLike}
        OR COALESCE(u.phone, '') LIKE ${searchLike}
      )
    `);
  }

  const whereSql = Prisma.join(conditions, " AND ");

  const [total, items] = await prisma.$transaction([
    prisma.order.count({ where }),
    prisma.$queryRaw<AdminOrderListQueryRow[]>(Prisma.sql`
      SELECT
        o.id,
        o.order_number,
        o.round_id,
        o.total_amount,
        o.shipping_fee,
        o.status,
        o.payment_amount,
        o.payment_last5,
        o.payment_reported_at,
        o.confirmed_at,
        o.shipped_at,
        o.pickup_location,
        o.created_at,
        preview.items_preview,
        u.nickname AS user_nickname,
        u.purchaser_name AS user_purchaser_name,
        u.recipient_name AS user_recipient_name,
        u.phone AS user_phone
      FROM orders o
      LEFT JOIN users u ON u.id = o.user_id
      LEFT JOIN LATERAL (
        SELECT
          string_agg(
            oi.product_name || ' ×' || oi.quantity::text,
            '、'
            ORDER BY oi.id
          ) AS items_preview
        FROM order_items oi
        WHERE oi.order_id = o.id
      ) preview ON true
      WHERE ${whereSql}
      ORDER BY o.created_at DESC
      OFFSET ${(page - 1) * pageSize}
      LIMIT ${pageSize}
    `),
  ]);

  return {
    items: items.map((item) =>
      toAdminOrderListRow({
        id: item.id,
        order_number: item.order_number,
        round_id: item.round_id,
        total_amount: item.total_amount,
        shipping_fee: item.shipping_fee,
        status: item.status,
        payment_amount: item.payment_amount,
        payment_last5: item.payment_last5,
        payment_reported_at: item.payment_reported_at,
        confirmed_at: item.confirmed_at,
        shipped_at: item.shipped_at,
        pickup_location: item.pickup_location,
        created_at: item.created_at,
        items_preview: item.items_preview ?? "",
        user: item.user_nickname
          ? {
              nickname: item.user_nickname,
              purchaser_name: item.user_purchaser_name,
              recipient_name: item.user_recipient_name,
              phone: item.user_phone,
            }
          : item.user_purchaser_name || item.user_recipient_name || item.user_phone
            ? {
                nickname: item.user_nickname,
                purchaser_name: item.user_purchaser_name,
                recipient_name: item.user_recipient_name,
                phone: item.user_phone,
              }
            : null,
      }),
    ),
    total,
    page,
    pageSize,
    hasMore: page * pageSize < total,
  };
}

export async function listRoundOrdersBatch(
  roundId: string,
  input?: {
    skip?: number;
    take?: number;
  },
) {
  return prisma.order.findMany({
    where: { round_id: roundId },
    include: orderWithAdminExportInclude,
    orderBy: { created_at: "desc" },
    skip: input?.skip ?? 0,
    take: input?.take ?? 500,
  });
}

export async function getPendingConfirmCount(roundId: string) {
  return prisma.order.count({
    where: {
      round_id: roundId,
      status: "pending_confirm",
    },
  });
}

export async function getRoundOrderStatusCounts(roundId: string) {
  return prisma.order.groupBy({
    by: ["status"],
    where: { round_id: roundId },
    _count: { _all: true },
  });
}

export async function getRoundRevenueTotal(roundId: string) {
  const result = await prisma.order.aggregate({
    where: {
      round_id: roundId,
      status: { not: "cancelled" },
    },
    _sum: { total_amount: true },
  });

  return result._sum.total_amount ?? 0;
}

export async function getRoundProductDemand(roundId: string) {
  return prisma.orderItem.groupBy({
    by: ["product_id", "product_name"],
    where: {
      order: {
        round_id: roundId,
        status: { not: "cancelled" },
      },
    },
    _sum: {
      quantity: true,
      subtotal: true,
    },
  });
}

export async function getOrdersByProduct(productId: string, roundId: string) {
  const items = await prisma.orderItem.findMany({
    where: {
      product_id: productId,
      order: { round_id: roundId, status: { not: "cancelled" } },
    },
    include: {
      order: { include: { user: true } },
    },
  });

  return items.map((item) => ({
    product_id: item.product_id,
    product_name: item.product_name,
    nickname: item.order.user?.nickname ?? "",
    purchaser_name: item.order.user?.purchaser_name ?? null,
    recipient_name: item.order.user?.recipient_name ?? null,
    phone: item.order.user?.phone ?? null,
    quantity: item.quantity,
    subtotal: item.subtotal,
    order_number: item.order.order_number,
    status: item.order.status,
    pickup_location: item.order.pickup_location,
    round_id: item.order.round_id,
  }));
}

export async function getCustomersForArrivalNotification(
  productId: string,
  roundId: string,
): Promise<{
  customerCount: number;
  lineUserIds: string[];
  emails: string[];
}> {
  const items = await prisma.orderItem.findMany({
    where: {
      product_id: productId,
      order: { round_id: roundId, status: { not: "cancelled" } },
    },
    include: {
      order: { include: { user: true } },
    },
  });

  // Dedupe delivery endpoints by value (per-order LINE linking means different
  // orders from the same user may have different link states)
  const lineUserIdSet = new Set<string>();
  const emailSet = new Set<string>();
  // Count unique customers by logical public identity rather than user snapshot ID.
  const customerIdSet = new Set<string>();

  for (const item of items) {
    customerIdSet.add(buildLogicalCustomerIdentityKey(item.order));

    const lineUserId = item.order.line_user_id;
    if (lineUserId) lineUserIdSet.add(lineUserId);

    const email = item.order.user?.email;
    if (email) emailSet.add(email.toLowerCase());
  }

  return {
    customerCount: customerIdSet.size,
    lineUserIds: Array.from(lineUserIdSet),
    emails: Array.from(emailSet),
  };
}

// ─── Status Mutations ────────────────────────────────────────

export async function reportPayment(
  orderId: string,
  amount: number,
  last5: string,
) {
  try {
    return await prisma.order.update({
      where: { id: orderId, status: "pending_payment" },
      data: {
        status: "pending_confirm",
        payment_amount: amount,
        payment_last5: last5,
        payment_reported_at: new Date(),
      },
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      return null;
    }
    throw err;
  }
}

export async function confirmOrder(orderId: string) {
  try {
    return await prisma.$transaction(async (tx) => {
      const order = await tx.order.update({
        where: { id: orderId, status: "pending_confirm" },
        data: { status: "confirmed", confirmed_at: new Date() },
        include: { order_items: true, user: true },
      });

      await enqueuePaymentConfirmedNotificationsTx(tx, order);
      return order;
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      return null;
    }
    throw err;
  }
}

export async function batchConfirm(orderIds: string[]) {
  return prisma.$transaction(async (tx) => {
    const pendingOrders = await tx.order.findMany({
      where: { id: { in: orderIds }, status: "pending_confirm" },
      select: { id: true },
    });

    const pendingIds = pendingOrders.map((order) => order.id);
    if (pendingIds.length === 0) {
      return [];
    }

    await tx.order.updateMany({
      where: { id: { in: pendingIds }, status: "pending_confirm" },
      data: { status: "confirmed", confirmed_at: new Date() },
    });

    const confirmedOrders = await tx.order.findMany({
      where: { id: { in: pendingIds }, status: "confirmed" },
      include: { order_items: true, user: true },
    });

    for (const order of confirmedOrders) {
      await enqueuePaymentConfirmedNotificationsTx(tx, order);
    }

    return confirmedOrders;
  });
}

export async function confirmShipment(orderId: string) {
  try {
    return await prisma.$transaction(async (tx) => {
      const order = await tx.order.update({
        where: { id: orderId, status: "confirmed" },
        data: { status: "shipped", shipped_at: new Date() },
        include: { order_items: true, user: true },
      });

      await enqueueShipmentNotificationsTx(tx, order);
      return order;
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      return null;
    }
    throw err;
  }
}

export async function batchConfirmShipment(orderIds: string[]) {
  return prisma.$transaction(async (tx) => {
    const confirmedOrders = await tx.order.findMany({
      where: { id: { in: orderIds }, status: "confirmed" },
      select: { id: true },
    });

    const confirmedIds = confirmedOrders.map((order) => order.id);
    if (confirmedIds.length === 0) {
      return [];
    }

    await tx.order.updateMany({
      where: { id: { in: confirmedIds }, status: "confirmed" },
      data: { status: "shipped", shipped_at: new Date() },
    });

    const shippedOrders = await tx.order.findMany({
      where: { id: { in: confirmedIds }, status: "shipped" },
      include: { order_items: true, user: true },
    });

    for (const order of shippedOrders) {
      await enqueueShipmentNotificationsTx(tx, order);
    }

    return shippedOrders;
  });
}

export async function cancelOrder(
  orderId: string,
  isAdmin?: boolean,
  cancelReason?: string,
) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { order_items: true, user: true },
    });
    if (!order) return null;
    if (order.status === "cancelled") {
      return { order, changed: false as const };
    }

    // User can only cancel pending_payment; admin can cancel any status
    if (!isAdmin && order.status !== "pending_payment") {
      return { error: "User can only cancel pending_payment orders" };
    }

    await tx.order.update({
      where: { id: orderId },
      data: {
        status: "cancelled",
        cancel_reason: cancelReason || null,
      },
    });

    // Restore stock for each item (skip for shipped orders — product already sent)
    if (order.status !== "shipped") {
      for (const item of sortByProductId(order.order_items)) {
        if (item.product_id) {
          await restoreStock(item.product_id, item.quantity, tx);
        }
      }
    }

    const cancelled = {
      ...order,
      status: "cancelled" as const,
      cancel_reason: cancelReason || null,
    };

    if (isAdmin) {
      await enqueueOrderCancelledNotificationsTx(tx, cancelled);
    }

    return { order: cancelled, changed: true as const };
  });
}

// ─── Quick Confirm (POS Cash Payment) ────────────────────────

export async function quickConfirm(orderId: string, paymentAmount: number) {
  try {
    return await prisma.$transaction(async (tx) => {
      const order = await tx.order.update({
        where: { id: orderId, status: "pending_payment" },
        data: {
          status: "confirmed",
          payment_amount: paymentAmount,
          payment_last5: "CASH",
          payment_reported_at: new Date(),
          confirmed_at: new Date(),
        },
        include: { order_items: true, user: true },
      });

      await enqueuePaymentConfirmedNotificationsTx(tx, order);
      return order;
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      return null;
    }
    throw err;
  }
}
