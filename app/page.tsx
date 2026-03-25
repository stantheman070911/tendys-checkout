export const revalidate = 30;

import Link from "next/link";
import { getOpenRound } from "@/lib/db/rounds";
import { listActiveByRound } from "@/lib/db/products";
import { prisma } from "@/lib/db/prisma";
import { StorefrontClient } from "@/components/StorefrontClient";
import {
  getPlaywrightStorefrontFixture,
  isPlaywrightAdminFixtureEnabled,
} from "@/lib/testing/playwright-admin";
import type { Round, ProductWithProgress } from "@/types";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ round?: string }>;
}) {
  const { round: roundId } = await searchParams;

  if (isPlaywrightAdminFixtureEnabled()) {
    const fixture = getPlaywrightStorefrontFixture();
    return (
      <StorefrontClient
        round={fixture.round}
        products={fixture.products}
      />
    );
  }

  const round = roundId
    ? await prisma.round.findUnique({ where: { id: roundId } })
    : await getOpenRound();

  if (!round) {
    return (
      <main className="lux-shell flex items-center justify-center px-4">
        <div className="lux-panel-strong max-w-xl space-y-4 p-8 text-center">
          <div className="lux-kicker">No Active Round</div>
          <p className="font-display text-3xl text-[hsl(var(--ink))]">
            目前沒有進行中的團購
          </p>
          <p className="text-sm leading-6 text-[hsl(var(--muted-foreground))]">
            開團後，這裡會顯示本輪精選商品與下單入口。
          </p>
          <Link
            href="/lookup"
            className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-[rgba(177,140,92,0.28)] bg-[rgba(255,251,246,0.9)] px-5 py-2.5 text-sm font-semibold text-[hsl(var(--ink))]"
          >
            查詢訂單
          </Link>
        </div>
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
    pickup_option_a: round.pickup_option_a,
    pickup_option_b: round.pickup_option_b,
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
