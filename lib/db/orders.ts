import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { isValidRoundPickupLocation } from "@/lib/pickup-options";
import { normalizePhoneDigits } from "@/lib/utils";

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

type OrderWithItems = Prisma.OrderGetPayload<{
  include: typeof orderWithItemsInclude;
}>;

type OrderWithRelations = Prisma.OrderGetPayload<{
  include: typeof orderWithRelationsInclude;
}>;

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

async function findPublicOrderIdsByIdentity(
  purchaserName: string,
  phoneLast3: string,
): Promise<string[]> {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT o.id
    FROM orders o
    INNER JOIN users u ON u.id = o.user_id
    WHERE lower(COALESCE(u.purchaser_name, '')) = lower(${purchaserName})
      AND RIGHT(REGEXP_REPLACE(COALESCE(u.phone, ''), '[^0-9]', '', 'g'), 3) = ${phoneLast3}
    ORDER BY o.created_at DESC
  `;

  return rows.map((row) => row.id);
}

async function findPublicOrderIdByOrderNumberAndIdentity(
  orderNumber: string,
  purchaserName: string,
  phoneLast3: string,
): Promise<string | null> {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT o.id
    FROM orders o
    INNER JOIN users u ON u.id = o.user_id
    WHERE o.order_number = ${orderNumber}
      AND lower(COALESCE(u.purchaser_name, '')) = lower(${purchaserName})
      AND RIGHT(REGEXP_REPLACE(COALESCE(u.phone, ''), '[^0-9]', '', 'g'), 3) = ${phoneLast3}
    LIMIT 1
  `;

  return rows[0]?.id ?? null;
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

  for (const item of items) {
    const product = productMap.get(item.product_id)!;

    const updated = await tx.$executeRaw`
      UPDATE products
      SET stock = CASE WHEN stock IS NOT NULL THEN stock - ${item.quantity} ELSE stock END
      WHERE id = ${item.product_id}::uuid AND (stock IS NULL OR stock >= ${item.quantity})
    `;
    if (updated === 0) {
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

export async function findOrdersByPurchaserNameAndPhoneLast3(
  purchaserName: string,
  phoneLast3: string,
): Promise<OrderWithRelations[]> {
  const orderIds = await findPublicOrderIdsByIdentity(purchaserName, phoneLast3);
  if (orderIds.length === 0) {
    return [];
  }

  return prisma.order.findMany({
    where: { id: { in: orderIds } },
    include: orderWithRelationsInclude,
    orderBy: { created_at: "desc" },
  });
}

export async function findPublicOrderByOrderNumberAndIdentity(
  orderNumber: string,
  purchaserName: string,
  phoneLast3: string,
): Promise<OrderWithRelations | null> {
  const orderId = await findPublicOrderIdByOrderNumberAndIdentity(
    orderNumber,
    purchaserName,
    phoneLast3,
  );

  if (!orderId) {
    return null;
  }

  return prisma.order.findUnique({
    where: { id: orderId },
    include: orderWithRelationsInclude,
  });
}

export async function listByRound(roundId: string, statusFilter?: string) {
  return prisma.order.findMany({
    where: {
      round_id: roundId,
      ...(statusFilter ? { status: statusFilter } : {}),
    },
    include: { order_items: true, user: true },
    orderBy: { created_at: "desc" },
  });
}

export async function listConfirmedByRound(roundId: string) {
  return listByRound(roundId, "confirmed");
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
    return await prisma.order.update({
      where: { id: orderId, status: "pending_confirm" },
      data: { status: "confirmed", confirmed_at: new Date() },
      include: { order_items: true, user: true },
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

    return tx.order.findMany({
      where: { id: { in: pendingIds }, status: "confirmed" },
      include: { order_items: true, user: true },
    });
  });
}

export async function confirmShipment(orderId: string) {
  try {
    return await prisma.order.update({
      where: { id: orderId, status: "confirmed" },
      data: { status: "shipped", shipped_at: new Date() },
      include: { order_items: true, user: true },
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

    return tx.order.findMany({
      where: { id: { in: confirmedIds }, status: "shipped" },
      include: { order_items: true, user: true },
    });
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
      for (const item of order.order_items) {
        if (item.product_id) {
          await tx.$executeRaw`
            UPDATE products
            SET stock = CASE WHEN stock IS NOT NULL THEN stock + ${item.quantity} ELSE stock END
            WHERE id = ${item.product_id}::uuid
          `;
        }
      }
    }

    const cancelled = {
      ...order,
      status: "cancelled" as const,
      cancel_reason: cancelReason || null,
    };
    return { order: cancelled, changed: true as const };
  });
}

// ─── Quick Confirm (POS Cash Payment) ────────────────────────

export async function quickConfirm(orderId: string, paymentAmount: number) {
  try {
    return await prisma.order.update({
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
