import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import type { Executor } from "@/db/executor";
import { type LedgerEntryType, ledgerEntries, wallets } from "@/db/schema";

/** Virtual-currency minor units granted to every new wallet. */
const SIGNUP_GRANT_AMOUNT = 100_000;

export async function getOrCreateWalletTx(executor: Executor, userId: string) {
  const [existing] = await executor.select().from(wallets).where(eq(wallets.userId, userId)).limit(1);
  if (existing) return existing;

  const [created] = await executor
    .insert(wallets)
    .values({ userId })
    .onConflictDoNothing()
    .returning();
  if (created) return created;

  // Lost a race to create the wallet — the other writer's row is there now.
  const [wallet] = await executor.select().from(wallets).where(eq(wallets.userId, userId)).limit(1);
  return wallet;
}

export function getOrCreateWallet(userId: string) {
  return db.transaction((tx) => getOrCreateWalletTx(tx, userId));
}

type WriteLedgerEntryParams = {
  walletId: string;
  type: LedgerEntryType;
  /** Signed, minor units — positive credits the wallet, negative debits it. */
  amount: number;
  idempotencyKey: string;
  relatedPositionId?: string | null;
  relatedMarketId?: string | null;
};

/**
 * Writes one ledger entry and updates the wallet's cached balance, atomically within the given
 * executor. Idempotent: a second call with the same idempotencyKey returns the original entry
 * without mutating the wallet again. Locks the wallet row so concurrent writes to the same
 * wallet serialize instead of racing on balanceAfter.
 *
 * Callers composing a ledger write into a larger atomic operation (e.g. buying a contract also
 * needs the position/trade rows to land or fail together with the debit) should pass their own
 * transaction here rather than calling the top-level writeLedgerEntry, which always opens its
 * own.
 */
export async function writeLedgerEntryTx(executor: Executor, params: WriteLedgerEntryParams) {
  const [existing] = await executor
    .select()
    .from(ledgerEntries)
    .where(eq(ledgerEntries.idempotencyKey, params.idempotencyKey))
    .limit(1);
  if (existing) return existing;

  const [wallet] = await executor
    .select()
    .from(wallets)
    .where(eq(wallets.id, params.walletId))
    .for("update");
  if (!wallet) throw new Error(`No wallet ${params.walletId}`);

  const balanceAfter = wallet.balance + params.amount;

  const [entry] = await executor
    .insert(ledgerEntries)
    .values({
      walletId: params.walletId,
      type: params.type,
      amount: params.amount,
      balanceAfter,
      relatedPositionId: params.relatedPositionId ?? null,
      relatedMarketId: params.relatedMarketId ?? null,
      idempotencyKey: params.idempotencyKey,
    })
    .returning();

  await executor
    .update(wallets)
    .set({ balance: balanceAfter, updatedAt: new Date() })
    .where(eq(wallets.id, params.walletId));

  return entry;
}

export function writeLedgerEntry(params: WriteLedgerEntryParams) {
  return db.transaction((tx) => writeLedgerEntryTx(tx, params));
}

/** Grants the one-time signup bonus. Idempotent per user — safe to call more than once. */
export async function grantSignupBonus(userId: string) {
  return db.transaction(async (tx) => {
    const wallet = await getOrCreateWalletTx(tx, userId);
    return writeLedgerEntryTx(tx, {
      walletId: wallet.id,
      type: "SIGNUP_GRANT",
      amount: SIGNUP_GRANT_AMOUNT,
      idempotencyKey: `signup-grant:${userId}`,
    });
  });
}

/**
 * Recomputes a wallet's balance from its ledger entries and corrects the cached balance if it
 * has drifted. The ledger is the source of truth; this is the repair path for wallets.balance.
 */
export async function reconcileWalletBalance(userId: string): Promise<number> {
  const wallet = await getOrCreateWallet(userId);
  const [{ total }] = await db
    .select({ total: sql<string>`coalesce(sum(${ledgerEntries.amount}), 0)` })
    .from(ledgerEntries)
    .where(eq(ledgerEntries.walletId, wallet.id));

  const computedBalance = Number(total);
  if (computedBalance !== wallet.balance) {
    await db
      .update(wallets)
      .set({ balance: computedBalance, updatedAt: new Date() })
      .where(eq(wallets.id, wallet.id));
  }
  return computedBalance;
}
