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
}) {
  return prisma.round.create({ data });
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
  }>
) {
  return prisma.round.update({ where: { id }, data });
}

export async function listRecent(limit = 5) {
  return prisma.round.findMany({
    orderBy: { created_at: "desc" },
    take: limit,
  });
}
