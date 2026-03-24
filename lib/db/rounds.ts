import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export async function getOpenRound() {
  return prisma.round.findFirst({
    where: { is_open: true },
    orderBy: { created_at: "desc" },
  });
}

export async function findById(id: string) {
  return prisma.round.findUnique({ where: { id } });
}

export async function create(data: {
  name: string;
  deadline?: Date | string | null;
  shipping_fee?: number | null;
  pickup_option_a?: string;
  pickup_option_b?: string;
}): Promise<
  { error: string } | Awaited<ReturnType<typeof prisma.round.create>>
> {
  try {
    // Atomic: close existing open rounds + create new one in a single transaction
    return await prisma.$transaction(async (tx) => {
      await tx.round.updateMany({
        where: { is_open: true },
        data: { is_open: false },
      });
      return tx.round.create({ data });
    });
  } catch (err) {
    // Catch DB unique-index conflict from concurrent creates
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return { error: "已有另一個團正在開團中（並行衝突），請重新整理頁面" };
    }
    throw err;
  }
}

export async function close(id: string) {
  return prisma.round.update({
    where: { id },
    data: { is_open: false },
  });
}

export async function updateDeadline(id: string, deadline: Date | string) {
  return prisma.round.update({
    where: { id },
    data: { deadline },
  });
}

export async function updateShippingFee(id: string, fee: number | null) {
  return prisma.round.update({
    where: { id },
    data: { shipping_fee: fee },
  });
}

export async function update(
  id: string,
  data: Partial<{
    name: string;
    is_open: boolean;
    deadline: Date | string | null;
    shipping_fee: number | null;
    pickup_option_a: string;
    pickup_option_b: string;
  }>,
): Promise<{ error: string } | ReturnType<typeof prisma.round.update>> {
  // Enforce single-open-round: friendly precheck before DB write
  if (data.is_open === true) {
    const existing = await prisma.round.findFirst({
      where: { is_open: true, id: { not: id } },
    });
    if (existing) {
      return {
        error: `另一個團「${existing.name}」正在開團中，請先截單再開啟此團`,
      };
    }
  }
  try {
    return await prisma.round.update({ where: { id }, data });
  } catch (err) {
    // Catch DB unique-index conflict from concurrent requests
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return { error: "已有另一個團正在開團中（並行衝突），請重新整理頁面" };
    }
    throw err;
  }
}

export async function listRecent(limit = 5) {
  return prisma.round.findMany({
    orderBy: { created_at: "desc" },
    take: limit,
  });
}
