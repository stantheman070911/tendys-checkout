import { prisma } from "@/lib/db/prisma";

export async function findByNickname(nickname: string) {
  return prisma.user.findUnique({ where: { nickname } });
}

export async function upsertByNickname(
  nickname: string,
  data: {
    recipient_name?: string;
    phone?: string;
    address?: string;
    email?: string;
  }
) {
  return prisma.user.upsert({
    where: { nickname },
    update: data,
    create: { nickname, ...data },
  });
}
