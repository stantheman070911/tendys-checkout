import { prisma } from "@/lib/db/prisma";

export async function list() {
  return prisma.supplier.findMany({
    include: { _count: { select: { products: true } } },
    orderBy: { name: "asc" },
  });
}

export async function findById(id: string) {
  return prisma.supplier.findUnique({
    where: { id },
    include: { products: true },
  });
}

export async function create(data: {
  name: string;
  contact_name?: string | null;
  phone?: string | null;
  email?: string | null;
  note?: string | null;
}) {
  return prisma.supplier.create({ data });
}

export async function update(
  id: string,
  data: Partial<{
    name: string;
    contact_name: string | null;
    phone: string | null;
    email: string | null;
    note: string | null;
  }>,
) {
  return prisma.supplier.update({ where: { id }, data });
}

export async function deleteSupplier(id: string) {
  const count = await prisma.product.count({ where: { supplier_id: id } });
  if (count > 0) {
    return { error: "Cannot delete supplier with linked products" };
  }
  await prisma.supplier.delete({ where: { id } });
  return { success: true };
}
