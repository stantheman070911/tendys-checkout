import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

type TxClient = Omit<
  typeof prisma,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

type ProductWithProgressRow = {
  id: string;
  round_id: string | null;
  supplier_id: string | null;
  name: string;
  price: number;
  unit: string;
  is_active: boolean;
  stock: number | null;
  goal_qty: number | null;
  image_url: string | null;
  created_at: Date;
  supplier_name: string | null;
  current_qty: number;
  progress_pct: number | null;
};

async function listByRound(
  roundId: string,
  activeOnly: boolean,
): Promise<ProductWithProgressRow[]> {
  if (activeOnly) {
    return prisma.$queryRaw<ProductWithProgressRow[]>`
      SELECT
        p.id, p.round_id, p.supplier_id, p.name, p.price, p.unit,
        p.is_active, p.stock, p.goal_qty, p.image_url, p.created_at,
        s.name AS supplier_name,
        COALESCE(pp.current_qty, 0)::int AS current_qty,
        pp.progress_pct::float AS progress_pct
      FROM products p
      LEFT JOIN product_progress pp ON pp.product_id = p.id
      LEFT JOIN suppliers s ON s.id = p.supplier_id
      WHERE p.round_id = ${roundId}::uuid AND p.is_active = true
      ORDER BY p.created_at ASC
    `;
  }
  return prisma.$queryRaw<ProductWithProgressRow[]>`
    SELECT
      p.id, p.round_id, p.supplier_id, p.name, p.price, p.unit,
      p.is_active, p.stock, p.goal_qty, p.image_url, p.created_at,
      s.name AS supplier_name,
      COALESCE(pp.current_qty, 0)::int AS current_qty,
      pp.progress_pct::float AS progress_pct
    FROM products p
    LEFT JOIN product_progress pp ON pp.product_id = p.id
    LEFT JOIN suppliers s ON s.id = p.supplier_id
    WHERE p.round_id = ${roundId}::uuid
    ORDER BY p.created_at ASC
  `;
}

export const listActiveByRound = (roundId: string) =>
  listByRound(roundId, true);
export const listAllByRound = (roundId: string) => listByRound(roundId, false);

export async function decrementStock(
  productId: string,
  qty: number,
  tx?: TxClient,
) {
  const client = tx ?? prisma;
  const result = await client.$executeRaw`
    UPDATE products
    SET stock = CASE WHEN stock IS NOT NULL THEN stock - ${qty} ELSE stock END
    WHERE id = ${productId}::uuid AND (stock IS NULL OR stock >= ${qty})
  `;
  return result > 0;
}

export async function restoreStock(
  productId: string,
  qty: number,
  tx?: TxClient,
) {
  const client = tx ?? prisma;
  await client.$executeRaw`
    UPDATE products
    SET stock = CASE WHEN stock IS NOT NULL THEN stock + ${qty} ELSE stock END
    WHERE id = ${productId}::uuid
  `;
}

// ─── CRUD ────────────────────────────────────────────────────

export async function findById(id: string) {
  return prisma.product.findUnique({ where: { id } });
}

export async function create(data: {
  name: string;
  price: number;
  unit: string;
  round_id: string;
  supplier_id?: string | null;
  stock?: number | null;
  goal_qty?: number | null;
  image_url?: string | null;
}) {
  return prisma.product.create({ data });
}

export async function update(
  id: string,
  data: Partial<{
    name: string;
    price: number;
    unit: string;
    round_id: string;
    supplier_id: string | null;
    is_active: boolean;
    stock: number | null;
    goal_qty: number | null;
    image_url: string | null;
  }>,
) {
  return prisma.product.update({ where: { id }, data });
}
