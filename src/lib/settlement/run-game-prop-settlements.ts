import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { contracts, markets } from "@/db/schema";
import type { StatsFeedClient } from "@/lib/stats-feed/types";
import { settleGameProp } from "./game-prop-settlement";
import { runMarketWithAudit } from "./job-runner";
import { settleMarketTx, voidMarketTx } from "./settlement-transaction";

export const GAME_PROP_JOB_TYPE = "settle-game-props";

export type GamePropSettlementOutcome =
  | "SETTLED"
  | "PUSH"
  | "SKIPPED_NOT_FINAL"
  | "SKIPPED_NO_STAT"
  | "SKIPPED_BACKOFF"
  | "FAILED";
export type GamePropSettlementRunResult = { marketId: string; outcome: GamePropSettlementOutcome };

/**
 * Finds every open/locked GAME_PROP market whose game has gone FINAL, resolves it via the
 * pure settleGameProp function, and writes the settlement + position/ledger updates in one
 * transaction per market. Each market's attempt is independently audited and backed off via
 * runMarketWithAudit — one market's failure doesn't block its siblings, and a repeatedly
 * failing market doesn't get retried on every single cron tick.
 */
export async function runGamePropSettlements(
  statsFeed: StatsFeedClient,
): Promise<GamePropSettlementRunResult[]> {
  const openMarkets = await db
    .select()
    .from(markets)
    .where(and(eq(markets.marketType, "GAME_PROP"), inArray(markets.status, ["OPEN", "LOCKED"])));

  const results: GamePropSettlementRunResult[] = [];

  for (const market of openMarkets) {
    if (!market.gameId) {
      results.push({ marketId: market.id, outcome: "SKIPPED_NOT_FINAL" });
      continue;
    }

    const gameStatus = await statsFeed.getGameStatus(market.gameId);
    if (gameStatus !== "FINAL") {
      results.push({ marketId: market.id, outcome: "SKIPPED_NOT_FINAL" });
      continue;
    }

    const actualValue = await statsFeed.getPlayerGameStat(market.playerId, market.gameId, market.statCategory);
    if (actualValue == null) {
      results.push({ marketId: market.id, outcome: "SKIPPED_NO_STAT" });
      continue;
    }

    const result = await runMarketWithAudit(GAME_PROP_JOB_TYPE, market.id, async () => {
      const settlementResult = settleGameProp(actualValue, market.thresholdValue);
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

    results.push(result as GamePropSettlementRunResult);
  }

  return results;
}
