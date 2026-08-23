import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import type { Executor } from "@/db/executor";
import { type Contract, contracts, markets, positions, settlements } from "@/db/schema";
import type { GamePropSide } from "@/lib/pricing/game-prop-pricing";
import type { StatsFeedClient } from "@/lib/stats-feed/types";
import { getOrCreateWalletTx, writeLedgerEntryTx } from "@/lib/wallet";
import { settleGameProp } from "./game-prop-settlement";

export type GamePropSettlementOutcome = "SETTLED" | "PUSH" | "SKIPPED_NOT_FINAL" | "SKIPPED_NO_STAT";
export type GamePropSettlementRunResult = { marketId: string; outcome: GamePropSettlementOutcome };

async function settleMarketTx(
  tx: Executor,
  marketId: string,
  marketContracts: Contract[],
  payouts: Record<GamePropSide, number>,
  actualValue: number,
) {
  await tx.update(markets).set({ status: "SETTLED", resolvedAt: new Date() }).where(eq(markets.id, marketId));

  const payoutsByContractId: Record<string, number> = {};
  for (const c of marketContracts) payoutsByContractId[c.id] = payouts[c.label as GamePropSide] ?? 0;

  await tx.insert(settlements).values({
    marketId,
    payouts: payoutsByContractId,
    resolutionSource: "STATS_FEED",
    resolutionData: { actualValue },
  });

  const contractIds = marketContracts.map((c) => c.id);
  const openPositions = await tx
    .select()
    .from(positions)
    .where(and(inArray(positions.contractId, contractIds), eq(positions.status, "OPEN")));

  for (const position of openPositions) {
    await tx.update(positions).set({ status: "SETTLED", updatedAt: new Date() }).where(eq(positions.id, position.id));

    const payoutRatio = payoutsByContractId[position.contractId] ?? 0;
    if (payoutRatio <= 0) continue;

    const wallet = await getOrCreateWalletTx(tx, position.userId);
    await writeLedgerEntryTx(tx, {
      walletId: wallet.id,
      type: "SETTLEMENT_PAYOUT",
      amount: Math.round(payoutRatio * 100) * position.quantity,
      idempotencyKey: `settlement-payout:${position.id}`,
      relatedPositionId: position.id,
      relatedMarketId: marketId,
    });
  }
}

/** A push doesn't fit the flat payoutRatio model — void the market and refund each position's own stake. */
async function voidMarketTx(tx: Executor, marketId: string, marketContracts: Contract[]) {
  await tx.update(markets).set({ status: "VOID", resolvedAt: new Date() }).where(eq(markets.id, marketId));

  const contractIds = marketContracts.map((c) => c.id);
  const openPositions = await tx
    .select()
    .from(positions)
    .where(and(inArray(positions.contractId, contractIds), eq(positions.status, "OPEN")));

  for (const position of openPositions) {
    await tx.update(positions).set({ status: "VOIDED", updatedAt: new Date() }).where(eq(positions.id, position.id));

    const wallet = await getOrCreateWalletTx(tx, position.userId);
    await writeLedgerEntryTx(tx, {
      walletId: wallet.id,
      type: "REFUND_VOID",
      amount: Math.round(position.avgEntryPrice * 100) * position.quantity,
      idempotencyKey: `refund-void:${position.id}`,
      relatedPositionId: position.id,
      relatedMarketId: marketId,
    });
  }
}

/**
 * Finds every open/locked GAME_PROP market whose game has gone FINAL, resolves it via the
 * pure settleGameProp function, and writes the settlement + position/ledger updates in one
 * transaction per market. Safe to re-run — already-settled/voided markets are excluded by the
 * status filter, and every ledger write is independently idempotent besides.
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

    const settlementResult = settleGameProp(actualValue, market.thresholdValue);
    const marketContracts = await db.select().from(contracts).where(eq(contracts.marketId, market.id));

    await db.transaction(async (tx) => {
      if (settlementResult.outcome === "PUSH") {
        await voidMarketTx(tx, market.id, marketContracts);
      } else {
        await settleMarketTx(tx, market.id, marketContracts, settlementResult.payouts, actualValue);
      }
    });

    results.push({ marketId: market.id, outcome: settlementResult.outcome });
  }

  return results;
}
