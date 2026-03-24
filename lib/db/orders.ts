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
  recipient_name: string | null;
  phone: string | null;
  address: string | null;
  email: string | null;
};

interface CheckoutUserInput {
  nickname: string;
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
      kind: "nickname_conflict";
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

type ResolveUserResult =
  | {
      kind: "success";
      user: CheckoutUserRecord;
    }
  | {
      kind: "nickname_conflict";
    };

// Thrown inside $transaction to trigger rollback while carrying a user-facing message
class OrderValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrderValidationError";
  }
}

function normalizeRecipientName(value: string | null | undefined): string {
  return (value ?? "").trim().toLocaleLowerCase();
}

function normalizeEmail(value: string | null | undefined): string {
  return (value ?? "").trim().toLocaleLowerCase();
}

function orderMatchesPublicIdentity(
  order: {
    user?: {
      recipient_name?: string | null;
      phone?: string | null;
    } | null;
  },
  recipientName: string,
  phoneLast3: string,
): boolean {
  return (
    normalizeRecipientName(order.user?.recipient_name) ===
      normalizeRecipientName(recipientName) &&
    normalizePhoneDigits(order.user?.phone).endsWith(phoneLast3)
  );
}

function hasPublicProfileConflict(
  existingUser: {
    phone?: string | null;
    recipient_name?: string | null;
    address?: string | null;
    email?: string | null;
  },
  nextUser: {
    phone?: string | undefined;
    recipient_name?: string | undefined;
    address?: string | undefined;
    email?: string | undefined;
  },
): boolean {
  return (
    normalizePhoneDigits(existingUser.phone) !==
      normalizePhoneDigits(nextUser.phone) ||
    normalizeRecipientName(existingUser.recipient_name) !==
      normalizeRecipientName(nextUser.recipient_name) ||
    (existingUser.address ?? "").trim() !== (nextUser.address ?? "").trim() ||
    normalizeEmail(existingUser.email) !== normalizeEmail(nextUser.email)
  );
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

async function insertPublicUserIfMissing(
  tx: TxClient,
  nickname: string,
  data: Omit<CheckoutUserInput, "nickname">,
): Promise<CheckoutUserRecord | null> {
  const users = await tx.$queryRaw<CheckoutUserRecord[]>`
    INSERT INTO public.users (nickname, recipient_name, phone, address, email)
    VALUES (
      ${nickname},
      ${data.recipient_name},
      ${data.phone},
      ${data.address ?? null},
      ${data.email ?? null}
    )
    ON CONFLICT (nickname) DO NOTHING
    RETURNING id, nickname, recipient_name, phone, address, email
  `;

  return users[0] ?? null;
}

async function upsertAdminUser(
  tx: TxClient,
  nickname: string,
  data: Omit<CheckoutUserInput, "nickname">,
): Promise<CheckoutUserRecord> {
  const users = await tx.$queryRaw<CheckoutUserRecord[]>`
    INSERT INTO public.users (nickname, recipient_name, phone, address, email)
    VALUES (
      ${nickname},
      ${data.recipient_name},
      ${data.phone},
      ${data.address ?? null},
      ${data.email ?? null}
    )
    ON CONFLICT (nickname) DO UPDATE
    SET
      recipient_name = EXCLUDED.recipient_name,
      phone = EXCLUDED.phone,
      address = EXCLUDED.address,
      email = EXCLUDED.email
    RETURNING id, nickname, recipient_name, phone, address, email
  `;

  return users[0]!;
}

async function resolveCheckoutUser(
  tx: TxClient,
  input: CreateCheckoutOrderInput,
): Promise<ResolveUserResult> {
  const userData = {
    recipient_name: input.user.recipient_name,
    phone: input.user.phone,
    address: input.user.address,
    email: input.user.email,
  };

  const existingUser = await tx.user.findUnique({
    where: { nickname: input.user.nickname },
  });

  if (existingUser) {
    if (input.is_admin) {
      return {
        kind: "success",
        user: await upsertAdminUser(tx, input.user.nickname, userData),
      };
    }

    return hasPublicProfileConflict(existingUser, userData)
      ? { kind: "nickname_conflict" }
      : { kind: "success", user: existingUser };
  }

  if (input.is_admin) {
    return {
      kind: "success",
      user: await upsertAdminUser(tx, input.user.nickname, userData),
    };
  }

  const insertedUser = await insertPublicUserIfMissing(
    tx,
    input.user.nickname,
    userData,
  );
  if (insertedUser) {
    return { kind: "success", user: insertedUser };
  }

  const concurrentUser = await tx.user.findUnique({
    where: { nickname: input.user.nickname },
  });
  if (!concurrentUser) {
    throw new Error(
      `Failed to resolve nickname after insert conflict: ${input.user.nickname}`,
    );
  }

  return hasPublicProfileConflict(concurrentUser, userData)
    ? { kind: "nickname_conflict" }
    : { kind: "success", user: concurrentUser };
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
  const shippingFee = isDelivery && round.shipping_fee ? round.shipping_fee : null;
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

      const resolvedUser = await resolveCheckoutUser(tx, input);
      if (resolvedUser.kind === "nickname_conflict") {
        return resolvedUser;
      }

      const order = await createOrderInTx(
        tx,
        {
          round_id: input.round_id,
          user_id: resolvedUser.user.id,
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

export async function findOrdersByRecipientNameAndPhoneLast3(
  recipientName: string,
  phoneLast3: string,
): Promise<OrderWithRelations[]> {
  const orders = await prisma.order.findMany({
    where: {
      user: {
        is: {
          recipient_name: {
            equals: recipientName,
            mode: "insensitive",
          },
        },
      },
    },
    include: orderWithRelationsInclude,
    orderBy: { created_at: "desc" },
  });

  return orders.filter((order) =>
    orderMatchesPublicIdentity(order, recipientName, phoneLast3),
  );
}

export async function findPublicOrderByOrderNumberAndIdentity(
  orderNumber: string,
  recipientName: string,
  phoneLast3: string,
): Promise<OrderWithRelations | null> {
  const order = await prisma.order.findFirst({
    where: {
      order_number: orderNumber,
      user: {
        is: {
          recipient_name: {
            equals: recipientName,
            mode: "insensitive",
          },
        },
      },
    },
    include: orderWithRelationsInclude,
  });

  if (!order || !orderMatchesPublicIdentity(order, recipientName, phoneLast3)) {
    return null;
  }

  return order;
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
  // Count unique customers by user_id (fall back to order.id for guest orders)
  const customerIdSet = new Set<string>();

  for (const item of items) {
    customerIdSet.add(item.order.user_id ?? item.order.id);

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
