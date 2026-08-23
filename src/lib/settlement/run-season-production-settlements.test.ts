import { beforeEach, describe, expect, it } from "vitest";

if (!process.env.TEST_DATABASE_URL?.includes("test")) {
  throw new Error("TEST_DATABASE_URL must be set and contain 'test'");
}
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

const { db } = await import("@/db/client");
const { eq } = await import("drizzle-orm");
const {
  contracts,
  ledgerEntries,
  markets,
  players,
  positions,
  settlements,
  trades,
  users,
  wallets,
} = await import("@/db/schema");
const { seasonProductionPrices } = await import("@/lib/pricing/season-production-pricing");
const { buyContract } = await import("@/lib/trading");
const { grantSignupBonus } = await import("@/lib/wallet");
const { createMockStatsFeedClient } = await import("@/lib/stats-feed/mock-client");
const { runSeasonProductionSettlements } = await import("./run-season-production-settlements");

async function seedUserWithBonus() {
  const [user] = await db
    .insert(users)
    .values({ clerkId: `clerk-${crypto.randomUUID()}`, email: `${crypto.randomUUID()}@example.com` })
    .returning();
  await grantSignupBonus(user.id);
  return user.id;
}

async function seedSeasonProductionMarket(threshold = 1000) {
  const [player] = await db
    .insert(players)
    .values({ name: "Pace Player", normalizedName: "pace player", position: "WR", nflTeam: "SF" })
    .returning();
  const prices = seasonProductionPrices({ projectedTotal: threshold, thresholdValue: threshold, sensitivity: 400, vig: 0.08 });
  const [market] = await db
    .insert(markets)
    .values({
      marketType: "SEASON_PRODUCTION",
      playerId: player.id,
      nflSeason: 2026,
      statCategory: "receiving_yards",
      thresholdValue: threshold,
      comparator: "OVER",
      pricingModel: "season-production-baseline-v1",
      closesAt: new Date(),
    })
    .returning();
  const [over, under] = await db
    .insert(contracts)
    .values([
      { marketId: market.id, label: "OVER", currentPrice: prices.OVER },
      { marketId: market.id, label: "UNDER", currentPrice: prices.UNDER },
    ])
    .returning();
  return { player, market, over, under };
}

describe("buy -> settle (season production)", () => {
  beforeEach(async () => {
    await db.delete(trades);
    await db.delete(ledgerEntries);
    await db.delete(positions);
    await db.delete(settlements);
    await db.delete(contracts);
    await db.delete(markets);
    await db.delete(players);
    await db.delete(wallets);
    await db.delete(users);
  });

  it("pays out the winning side once the season is complete", async () => {
    const userId = await seedUserWithBonus();
    const { market, player, over } = await seedSeasonProductionMarket(1000);

    await buyContract(userId, over.id, 10);
    const [walletAfterBuy] = await db.select().from(wallets).where(eq(wallets.userId, userId));

    const statsFeed = createMockStatsFeedClient({
      seasonComplete: { 2026: true },
      playerSeasonStats: { [`${player.id}:2026:receiving_yards`]: 1360 },
    });

    const results = await runSeasonProductionSettlements(statsFeed);
    expect(results).toContainEqual({ marketId: market.id, outcome: "SETTLED" });

    const [settledMarket] = await db.select().from(markets).where(eq(markets.id, market.id));
    expect(settledMarket.status).toBe("SETTLED");

    const [settlementRow] = await db.select().from(settlements).where(eq(settlements.marketId, market.id));
    expect(settlementRow.resolutionData).toMatchObject({ actualValue: 1360 });

    const [wallet] = await db.select().from(wallets).where(eq(wallets.userId, userId));
    expect(wallet.balance).toBe(walletAfterBuy.balance + 1000);
  });

  it("does not reprice per-trade — the price stays fixed between the weekly job runs", async () => {
    const userId = await seedUserWithBonus();
    const { over } = await seedSeasonProductionMarket(1000);
    const [beforeBuy] = await db.select().from(contracts).where(eq(contracts.id, over.id));

    await buyContract(userId, over.id, 10);

    const [afterBuy] = await db.select().from(contracts).where(eq(contracts.id, over.id));
    expect(afterBuy.currentPrice).toBe(beforeBuy.currentPrice);
  });

  it("skips markets whose season hasn't ended yet", async () => {
    const { market } = await seedSeasonProductionMarket();
    const statsFeed = createMockStatsFeedClient({ seasonComplete: { 2026: false } });

    const results = await runSeasonProductionSettlements(statsFeed);
    expect(results).toContainEqual({ marketId: market.id, outcome: "SKIPPED_NOT_FINAL" });
  });

  it("voids the market on a push", async () => {
    const userId = await seedUserWithBonus();
    const { market, player, over } = await seedSeasonProductionMarket(1000);
    await buyContract(userId, over.id, 5);

    const statsFeed = createMockStatsFeedClient({
      seasonComplete: { 2026: true },
      playerSeasonStats: { [`${player.id}:2026:receiving_yards`]: 1000 },
    });

    const results = await runSeasonProductionSettlements(statsFeed);
    expect(results).toContainEqual({ marketId: market.id, outcome: "PUSH" });

    const [voidedMarket] = await db.select().from(markets).where(eq(markets.id, market.id));
    expect(voidedMarket.status).toBe("VOID");
  });
});
