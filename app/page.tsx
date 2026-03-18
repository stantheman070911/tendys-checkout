export const dynamic = "force-dynamic";

import { getOpenRound } from "@/lib/db/rounds";
import { listActiveByRound } from "@/lib/db/products";
import { StorefrontClient } from "@/components/StorefrontClient";
import type { Round, ProductWithProgress } from "@/types";

export default async function Home() {
  const round = await getOpenRound();

  if (!round) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <p className="text-lg text-muted-foreground">目前沒有進行中的團購</p>
      </main>
    );
  }

  const rawProducts = await listActiveByRound(round.id);

  // Serialize for client component (Date → string)
  const serializedRound: Round = {
    id: round.id,
    name: round.name,
    is_open: round.is_open,
    deadline: round.deadline ? new Date(round.deadline).toISOString() : null,
    shipping_fee: round.shipping_fee,
    created_at: new Date(round.created_at).toISOString(),
  };

  const serializedProducts: ProductWithProgress[] = rawProducts.map((p) => ({
    id: p.id,
    round_id: p.round_id,
    supplier_id: p.supplier_id,
    name: p.name,
    price: Number(p.price),
    unit: p.unit,
    is_active: p.is_active,
    stock: p.stock !== null ? Number(p.stock) : null,
    goal_qty: p.goal_qty !== null ? Number(p.goal_qty) : null,
    image_url: p.image_url,
    created_at: new Date(p.created_at).toISOString(),
    supplier_name: p.supplier_name,
    current_qty: Number(p.current_qty),
    progress_pct: p.progress_pct !== null ? Number(p.progress_pct) : null,
  }));

  return (
    <StorefrontClient round={serializedRound} products={serializedProducts} />
  );
}
