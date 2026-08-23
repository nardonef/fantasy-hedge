import { beforeEach, describe, expect, it } from "vitest";

if (!process.env.TEST_DATABASE_URL?.includes("test")) {
  throw new Error("TEST_DATABASE_URL must be set and contain 'test'");
}
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

const { db } = await import("@/db/client");
const { eq } = await import("drizzle-orm");
const { contracts, ledgerEntries, markets, players, positions, settlements, trades, users, wallets } =
  await import("@/db/schema");
const { buyContract } = await import("@/lib/trading");
const { grantSignupBonus } = await import("@/lib/wallet");
const { manuallySettleMarket, manuallyVoidMarket } = await import("./manual-override");

async function seedUserWithBonus() {
  const [user] = await db
    .insert(users)
    .values({ clerkId: `clerk-${crypto.randomUUID()}`, email: `${crypto.randomUUID()}@example.com` })
    .returning();
  await grantSignupBonus(user.id);
  return user.id;
}

async function seedMarket() {
  const [player] = await db
    .insert(players)
    .values({ name: "Override Player", normalizedName: "override player", position: "RB", nflTeam: "SF" })
    .returning();
  const [market] = await db
    .insert(markets)
    .values({
      marketType: "INJURY_PROTECTION",
      playerId: player.id,
      nflSeason: 2026,
      statCategory: "games_missed",
      thresholdValue: 0,
      comparator: "AT_LEAST",
      pricingModel: "test",
      closesAt: new Date(),
    })
    .returning();
  const contractRows = await db
    .insert(contracts)
    .values([
      { marketId: market.id, label: "ZERO_GAMES", currentPrice: 0.5 },
      { marketId: market.id, label: "ONE_TO_TWO_GAMES", currentPrice: 0.3 },
      { marketId: market.id, label: "THREE_PLUS_GAMES", currentPrice: 0.2 },
    ])
    .returning();
  return { market, contracts: contractRows };
}

describe("manuallySettleMarket / manuallyVoidMarket", () => {
  beforeEach(async () => {
    // One transaction, not sequential autocommit statements — guarantees every delete lands on
    // the same connection in FK-dependency order with no visibility gap between them.
    await db.transaction(async (tx) => {
      await tx.delete(trades);
      await tx.delete(ledgerEntries);
      await tx.delete(positions);
      await tx.delete(settlements);
      await tx.delete(contracts);
      await tx.delete(markets);
      await tx.delete(players);
      await tx.delete(wallets);
      await tx.delete(users);
    });
  });

  it("settles the chosen contract as the winner and pays out its holders", async () => {
    const userId = await seedUserWithBonus();
    const { market, contracts: marketContracts } = await seedMarket();
    const oneToTwo = marketContracts.find((c) => c.label === "ONE_TO_TWO_GAMES");
    if (!oneToTwo) throw new Error("missing contract");

    await buyContract(userId, oneToTwo.id, 4);
    const [walletAfterBuy] = await db.select().from(wallets).where(eq(wallets.userId, userId));

    await manuallySettleMarket(market.id, oneToTwo.id);

    const [settledMarket] = await db.select().from(markets).where(eq(markets.id, market.id));
    expect(settledMarket.status).toBe("SETTLED");

    const [settlementRow] = await db.select().from(settlements).where(eq(settlements.marketId, market.id));
    expect(settlementRow.resolutionSource).toBe("MANUAL_OVERRIDE");
    expect(settlementRow.payouts[oneToTwo.id]).toBe(1);

    const [wallet] = await db.select().from(wallets).where(eq(wallets.userId, userId));
    expect(wallet.balance).toBe(walletAfterBuy.balance + 400); // 1 x 100 cents x 4 shares
  });

  it("rejects a winning contract that doesn't belong to the market", async () => {
    const { market } = await seedMarket();
    await expect(manuallySettleMarket(market.id, "00000000-0000-0000-0000-000000000000")).rejects.toThrow(
      /does not belong/,
    );
  });

  it("refuses to settle a market that's already settled", async () => {
    const { market, contracts: marketContracts } = await seedMarket();
    const zero = marketContracts.find((c) => c.label === "ZERO_GAMES");
    if (!zero) throw new Error("missing contract");

    await manuallySettleMarket(market.id, zero.id);
    await expect(manuallySettleMarket(market.id, zero.id)).rejects.toThrow(/not open/);
  });

  it("voids the market and refunds each open position's own stake", async () => {
    const userId = await seedUserWithBonus();
    const { market, contracts: marketContracts } = await seedMarket();
    const zero = marketContracts.find((c) => c.label === "ZERO_GAMES");
    if (!zero) throw new Error("missing contract");

    await buyContract(userId, zero.id, 6);
    const [walletAfterBuy] = await db.select().from(wallets).where(eq(wallets.userId, userId));

    await manuallyVoidMarket(market.id);

    const [voidedMarket] = await db.select().from(markets).where(eq(markets.id, market.id));
    expect(voidedMarket.status).toBe("VOID");

    const [wallet] = await db.select().from(wallets).where(eq(wallets.userId, userId));
    expect(wallet.balance).toBe(walletAfterBuy.balance + 300); // 0.5 x 100 cents x 6 shares refunded
  });
});
