import { beforeEach, describe, expect, it } from "vitest";

if (!process.env.TEST_DATABASE_URL?.includes("test")) {
  throw new Error("TEST_DATABASE_URL must be set and contain 'test'");
}
// db/client.ts reads DATABASE_URL at import time — point it at the test database before the
// first (dynamic) import of anything that transitively imports it.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

const { db } = await import("@/db/client");
const { eq } = await import("drizzle-orm");
const { ledgerEntries, trades, users, wallets } = await import("@/db/schema");
const { getOrCreateWallet, grantSignupBonus, reconcileWalletBalance, writeLedgerEntry } =
  await import("./wallet");

async function seedUser() {
  const [user] = await db
    .insert(users)
    .values({ clerkId: `clerk-${crypto.randomUUID()}`, email: `${crypto.randomUUID()}@example.com` })
    .returning();
  return user.id;
}

describe("wallet", () => {
  beforeEach(async () => {
    // trades.ledgerEntryId has no cascade — a trade left behind by another test file (e.g. via
    // buyContract) blocks deleting the ledgerEntries row it references unless cleared first.
    await db.transaction(async (tx) => {
      await tx.delete(trades);
      await tx.delete(ledgerEntries);
      await tx.delete(wallets);
      await tx.delete(users);
    });
  });

  describe("getOrCreateWallet", () => {
    it("creates a zero-balance wallet on first call", async () => {
      const userId = await seedUser();
      const wallet = await getOrCreateWallet(userId);
      expect(wallet.balance).toBe(0);
      expect(wallet.currency).toBe("VIRTUAL");
    });

    it("returns the same wallet on subsequent calls", async () => {
      const userId = await seedUser();
      const first = await getOrCreateWallet(userId);
      const second = await getOrCreateWallet(userId);
      expect(second.id).toBe(first.id);

      const allWallets = await db.select().from(wallets).where(eq(wallets.userId, userId));
      expect(allWallets).toHaveLength(1);
    });
  });

  describe("writeLedgerEntry", () => {
    it("credits and debits the wallet balance correctly", async () => {
      const userId = await seedUser();
      const wallet = await getOrCreateWallet(userId);

      const credit = await writeLedgerEntry({
        walletId: wallet.id,
        type: "SIGNUP_GRANT",
        amount: 1000,
        idempotencyKey: "credit-1",
      });
      expect(credit.balanceAfter).toBe(1000);

      const debit = await writeLedgerEntry({
        walletId: wallet.id,
        type: "CONTRACT_BUY",
        amount: -300,
        idempotencyKey: "debit-1",
      });
      expect(debit.balanceAfter).toBe(700);

      const [reloaded] = await db.select().from(wallets).where(eq(wallets.id, wallet.id));
      expect(reloaded.balance).toBe(700);
    });

    it("is idempotent — replaying the same idempotencyKey does not double-apply", async () => {
      const userId = await seedUser();
      const wallet = await getOrCreateWallet(userId);

      const first = await writeLedgerEntry({
        walletId: wallet.id,
        type: "SIGNUP_GRANT",
        amount: 500,
        idempotencyKey: "same-key",
      });
      const second = await writeLedgerEntry({
        walletId: wallet.id,
        type: "SIGNUP_GRANT",
        amount: 500,
        idempotencyKey: "same-key",
      });

      expect(second.id).toBe(first.id);
      const [reloaded] = await db.select().from(wallets).where(eq(wallets.id, wallet.id));
      expect(reloaded.balance).toBe(500);
      expect(await db.select().from(ledgerEntries)).toHaveLength(1);
    });
  });

  describe("grantSignupBonus", () => {
    it("grants the bonus exactly once across repeated calls", async () => {
      const userId = await seedUser();
      await grantSignupBonus(userId);
      const second = await grantSignupBonus(userId);

      const wallet = await getOrCreateWallet(userId);
      expect(wallet.balance).toBe(100_000);
      expect(second.balanceAfter).toBe(100_000);
      expect(await db.select().from(ledgerEntries)).toHaveLength(1);
    });
  });

  describe("reconcileWalletBalance", () => {
    it("repairs a drifted cached balance to match the ledger sum", async () => {
      const userId = await seedUser();
      const wallet = await getOrCreateWallet(userId);
      await writeLedgerEntry({
        walletId: wallet.id,
        type: "SIGNUP_GRANT",
        amount: 1000,
        idempotencyKey: "drift-test",
      });

      // Simulate drift: something wrote to wallets.balance outside the ledger.
      await db.update(wallets).set({ balance: 999_999 }).where(eq(wallets.id, wallet.id));

      const reconciled = await reconcileWalletBalance(userId);
      expect(reconciled).toBe(1000);

      const [reloaded] = await db.select().from(wallets).where(eq(wallets.id, wallet.id));
      expect(reloaded.balance).toBe(1000);
    });

    it("leaves a correct balance unchanged", async () => {
      const userId = await seedUser();
      const wallet = await getOrCreateWallet(userId);
      await writeLedgerEntry({
        walletId: wallet.id,
        type: "SIGNUP_GRANT",
        amount: 500,
        idempotencyKey: "no-drift",
      });

      expect(await reconcileWalletBalance(userId)).toBe(500);
    });
  });
});
