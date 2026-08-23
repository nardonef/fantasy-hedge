import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { contracts, markets } from "@/db/schema";
import { settleMarketTx, voidMarketTx } from "./settlement-transaction";

async function loadOpenMarketContracts(marketId: string) {
  const [market] = await db.select().from(markets).where(eq(markets.id, marketId)).limit(1);
  if (!market || (market.status !== "OPEN" && market.status !== "LOCKED")) {
    throw new Error("Market is not open — it may already be settled or voided");
  }
  return db.select().from(contracts).where(eq(contracts.marketId, marketId));
}

/** Settles a market by hand — winningContractId gets a payout ratio of 1, every other contract 0. */
export async function manuallySettleMarket(marketId: string, winningContractId: string): Promise<void> {
  const marketContracts = await loadOpenMarketContracts(marketId);
  if (!marketContracts.some((c) => c.id === winningContractId)) {
    throw new Error("Winning contract does not belong to this market");
  }

  const payoutsByLabel: Record<string, number> = {};
  for (const c of marketContracts) payoutsByLabel[c.label] = c.id === winningContractId ? 1 : 0;

  await db.transaction(async (tx) => {
    await settleMarketTx(tx, marketId, marketContracts, payoutsByLabel, { manualOverride: true }, "MANUAL_OVERRIDE");
  });
}

/** Voids a market by hand, refunding every open position's own stake. */
export async function manuallyVoidMarket(marketId: string): Promise<void> {
  const marketContracts = await loadOpenMarketContracts(marketId);

  await db.transaction(async (tx) => {
    await voidMarketTx(tx, marketId, marketContracts);
  });
}
