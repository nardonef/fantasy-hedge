import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { contracts, markets } from "@/db/schema";
import type { StatsFeedClient } from "@/lib/stats-feed/types";
import { settleInjuryProtection } from "./injury-protection-settlement";
import { settleMarketTx } from "./settlement-transaction";

export type InjuryProtectionSettlementOutcome = "SETTLED" | "SKIPPED_NOT_FINAL" | "SKIPPED_NO_STAT";
export type InjuryProtectionSettlementRunResult = { marketId: string; outcome: InjuryProtectionSettlementOutcome };

/**
 * Finds every open/locked INJURY_PROTECTION market whose season has ended, resolves it against
 * the player's games-missed count, and writes the settlement + position/ledger updates in one
 * transaction per market. Safe to re-run.
 */
export async function runInjuryProtectionSettlements(
  statsFeed: StatsFeedClient,
): Promise<InjuryProtectionSettlementRunResult[]> {
  const openMarkets = await db
    .select()
    .from(markets)
    .where(and(eq(markets.marketType, "INJURY_PROTECTION"), inArray(markets.status, ["OPEN", "LOCKED"])));

  const results: InjuryProtectionSettlementRunResult[] = [];

  for (const market of openMarkets) {
    const seasonDone = await statsFeed.isSeasonComplete(market.nflSeason);
    if (!seasonDone) {
      results.push({ marketId: market.id, outcome: "SKIPPED_NOT_FINAL" });
      continue;
    }

    const gamesMissed = await statsFeed.getPlayerGamesMissed(market.playerId, market.nflSeason);
    if (gamesMissed == null) {
      results.push({ marketId: market.id, outcome: "SKIPPED_NO_STAT" });
      continue;
    }

    const settlementResult = settleInjuryProtection(gamesMissed);
    const marketContracts = await db.select().from(contracts).where(eq(contracts.marketId, market.id));

    await db.transaction(async (tx) => {
      await settleMarketTx(tx, market.id, marketContracts, settlementResult.payouts, { gamesMissed });
    });

    results.push({ marketId: market.id, outcome: settlementResult.outcome });
  }

  return results;
}
