import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { contracts, markets, positions, trades } from "@/db/schema";
import { type GamePropPrices, type GamePropSide, repriceAfterTrade } from "@/lib/pricing/game-prop-pricing";
import { getOrCreateWalletTx, writeLedgerEntryTx } from "@/lib/wallet";

/**
 * Buys `quantity` shares of one contract at its currently quoted price, for an already-resolved
 * local user. Atomic: the wallet debit, position upsert, trade record, and contract reprice all
 * land together or not at all — this composes writeLedgerEntryTx into one transaction rather
 * than calling the top-level writeLedgerEntry, which would open its own and let the debit
 * succeed independently of the position ever being recorded.
 */
export async function buyContract(
  userId: string,
  contractId: string,
  quantity: number,
): Promise<{ tradeId: string; marketId: string; balanceAfter: number }> {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error("Quantity must be a positive integer");
  }

  return db.transaction(async (tx) => {
    const [contract] = await tx
      .select()
      .from(contracts)
      .where(eq(contracts.id, contractId))
      .for("update");
    if (!contract) throw new Error("Contract not found");

    const [market] = await tx.select().from(markets).where(eq(markets.id, contract.marketId)).limit(1);
    if (!market || market.status !== "OPEN") throw new Error("This market isn't open for trading");

    const wallet = await getOrCreateWalletTx(tx, userId);
    const notionalAmount = Math.round(contract.currentPrice * 100) * quantity;
    if (wallet.balance < notionalAmount) throw new Error("Insufficient balance");

    const tradeId = randomUUID();
    const ledgerEntry = await writeLedgerEntryTx(tx, {
      walletId: wallet.id,
      type: "CONTRACT_BUY",
      amount: -notionalAmount,
      idempotencyKey: `trade:${tradeId}`,
      relatedMarketId: market.id,
    });

    const [existingPosition] = await tx
      .select()
      .from(positions)
      .where(and(eq(positions.userId, userId), eq(positions.contractId, contractId)))
      .for("update");

    if (existingPosition) {
      const newQuantity = existingPosition.quantity + quantity;
      const newAvgEntryPrice =
        (existingPosition.avgEntryPrice * existingPosition.quantity + contract.currentPrice * quantity) /
        newQuantity;
      await tx
        .update(positions)
        .set({ quantity: newQuantity, avgEntryPrice: newAvgEntryPrice, updatedAt: new Date() })
        .where(eq(positions.id, existingPosition.id));
    } else {
      await tx.insert(positions).values({
        userId,
        contractId,
        marketId: market.id,
        quantity,
        avgEntryPrice: contract.currentPrice,
      });
    }

    await tx.insert(trades).values({
      id: tradeId,
      userId,
      contractId,
      direction: "BUY",
      quantity,
      priceAtExecution: contract.currentPrice,
      notionalAmount,
      ledgerEntryId: ledgerEntry.id,
    });

    const marketContracts = await tx.select().from(contracts).where(eq(contracts.marketId, market.id));
    const overContract = marketContracts.find((c) => c.label === "OVER");
    const underContract = marketContracts.find((c) => c.label === "UNDER");
    if (overContract && underContract) {
      const currentPrices: GamePropPrices = { OVER: overContract.currentPrice, UNDER: underContract.currentPrice };
      const newPrices = repriceAfterTrade(currentPrices, contract.label as GamePropSide, quantity);
      await tx
        .update(contracts)
        .set({ currentPrice: newPrices.OVER, updatedAt: new Date() })
        .where(eq(contracts.id, overContract.id));
      await tx
        .update(contracts)
        .set({ currentPrice: newPrices.UNDER, updatedAt: new Date() })
        .where(eq(contracts.id, underContract.id));
    }

    return { tradeId, marketId: market.id, balanceAfter: ledgerEntry.balanceAfter };
  });
}
