import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { contracts, markets } from "@/db/schema";
import type { StatsFeedClient } from "@/lib/stats-feed/types";
import { runMarketWithAudit } from "./job-runner";
import { settleSeasonProduction } from "./season-production-settlement";
import { settleMarketTx, voidMarketTx } from "./settlement-transaction";

export const SEASON_PRODUCTION_JOB_TYPE = "settle-season-production";

export type SeasonProductionSettlementOutcome =
  | "SETTLED"
  | "PUSH"
  | "SKIPPED_NOT_FINAL"
  | "SKIPPED_NO_STAT"
  | "SKIPPED_BACKOFF"
  | "FAILED";
export type SeasonProductionSettlementRunResult = { marketId: string; outcome: SeasonProductionSettlementOutcome };

/**
 * Finds every open/locked SEASON_PRODUCTION market whose season has ended, resolves it against
 * the player's cumulative season stat total, and writes the settlement + position/ledger
 * updates in one transaction per market. Each market's attempt is independently audited and
 * backed off via runMarketWithAudit.
 */
export async function runSeasonProductionSettlements(
  statsFeed: StatsFeedClient,
): Promise<SeasonProductionSettlementRunResult[]> {
  const openMarkets = await db
    .select()
    .from(markets)
    .where(and(eq(markets.marketType, "SEASON_PRODUCTION"), inArray(markets.status, ["OPEN", "LOCKED"])));

  const results: SeasonProductionSettlementRunResult[] = [];

  for (const market of openMarkets) {
    const seasonDone = await statsFeed.isSeasonComplete(market.nflSeason);
    if (!seasonDone) {
      results.push({ marketId: market.id, outcome: "SKIPPED_NOT_FINAL" });
      continue;
    }

    const actualValue = await statsFeed.getPlayerSeasonStat(market.playerId, market.nflSeason, market.statCategory);
    if (actualValue == null) {
      results.push({ marketId: market.id, outcome: "SKIPPED_NO_STAT" });
      continue;
    }

    const result = await runMarketWithAudit(SEASON_PRODUCTION_JOB_TYPE, market.id, async () => {
      const settlementResult = settleSeasonProduction(actualValue, market.thresholdValue);
      const marketContracts = await db.select().from(contracts).where(eq(contracts.marketId, market.id));

      await db.transaction(async (tx) => {
        if (settlementResult.outcome === "PUSH") {
          await voidMarketTx(tx, market.id, marketContracts);
        } else {
          await settleMarketTx(tx, market.id, marketContracts, settlementResult.payouts, { actualValue });
        }
      });

      return { outcome: settlementResult.outcome };
    });

    results.push(result as SeasonProductionSettlementRunResult);
  }

  return results;
}
