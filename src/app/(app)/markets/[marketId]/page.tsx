import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { db } from "@/db/client";
import { contracts, markets, players } from "@/db/schema";
import { comparatorSymbol } from "@/lib/comparator";
import { LivePrices } from "./live-prices";

const TYPE_LABEL = {
  GAME_PROP: "Game prop",
  SEASON_PRODUCTION: "Season production",
  INJURY_PROTECTION: "Injury protection",
} as const;

export default async function MarketPage({ params }: { params: Promise<{ marketId: string }> }) {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in");

  const { marketId } = await params;

  const [row] = await db
    .select({ market: markets, playerName: players.name })
    .from(markets)
    .innerJoin(players, eq(markets.playerId, players.id))
    .where(eq(markets.id, marketId))
    .limit(1);
  if (!row) notFound();

  const marketContracts = await db.select().from(contracts).where(eq(contracts.marketId, marketId));

  return (
    <div className="mx-auto flex max-w-xl flex-1 flex-col gap-6 px-6 py-12">
      <div className="flex flex-col gap-3">
        <p className="kicker text-hedge">{TYPE_LABEL[row.market.marketType]}</p>
        <h1 className="text-4xl font-semibold leading-none tracking-[-0.04em]">{row.playerName}</h1>
        <p className="font-mono text-[13px] uppercase text-chalk-dim">
          {row.market.statCategory} · {comparatorSymbol(row.market.comparator)} {row.market.thresholdValue}
        </p>
      </div>
      <LivePrices
        marketId={marketId}
        initialStatus={row.market.status}
        initialContracts={marketContracts.map((c) => ({
          id: c.id,
          label: c.label,
          currentPrice: c.currentPrice,
        }))}
      />
    </div>
  );
}
