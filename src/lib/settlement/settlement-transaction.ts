import { and, eq, inArray } from "drizzle-orm";
import type { Executor } from "@/db/executor";
import { type Contract, type ResolutionSource, contracts, markets, positions, settlements } from "@/db/schema";
import { getOrCreateWalletTx, writeLedgerEntryTx } from "@/lib/wallet";

/**
 * Marks a market SETTLED, writes the settlements row, and pays out winning open positions.
 * Market-type-agnostic — works for a binary OVER/UNDER market or an N-tier one, since payouts
 * are keyed by contract label either way. Shared by every settlement runner so the position/
 * ledger-writing logic exists in exactly one place.
 */
export async function settleMarketTx(
  tx: Executor,
  marketId: string,
  marketContracts: Contract[],
  payoutsByLabel: Record<string, number>,
  resolutionData: unknown,
  resolutionSource: ResolutionSource = "STATS_FEED",
): Promise<void> {
  await tx.update(markets).set({ status: "SETTLED", resolvedAt: new Date() }).where(eq(markets.id, marketId));

  const payoutsByContractId: Record<string, number> = {};
  for (const c of marketContracts) payoutsByContractId[c.id] = payoutsByLabel[c.label] ?? 0;

  await tx.insert(settlements).values({ marketId, payouts: payoutsByContractId, resolutionSource, resolutionData });

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

/** A push doesn't fit the flat payoutRatio model — voids the market and refunds each position's own stake. */
export async function voidMarketTx(tx: Executor, marketId: string, marketContracts: Contract[]): Promise<void> {
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
