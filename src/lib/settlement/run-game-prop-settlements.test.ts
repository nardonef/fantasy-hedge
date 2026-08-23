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
  nflGames,
  players,
  positions,
  settlements,
  trades,
  users,
  wallets,
} = await import("@/db/schema");
const { initialGamePropPrices } = await import("@/lib/pricing/game-prop-pricing");
const { buyContract } = await import("@/lib/trading");
const { grantSignupBonus } = await import("@/lib/wallet");
const { createMockStatsFeedClient } = await import("@/lib/stats-feed/mock-client");
const { runGamePropSettlements } = await import("./run-game-prop-settlements");

async function seedUserWithBonus() {
  const [user] = await db
    .insert(users)
    .values({ clerkId: `clerk-${crypto.randomUUID()}`, email: `${crypto.randomUUID()}@example.com` })
    .returning();
  await grantSignupBonus(user.id);
  return user.id;
}

async function seedGamePropMarket(threshold = 74.5) {
  const [player] = await db
    .insert(players)
    .values({ name: "Star Player", normalizedName: "star player", position: "WR", nflTeam: "SF" })
    .returning();
  const [game] = await db
    .insert(nflGames)
    .values({
      season: 2026,
      week: 3,
      homeTeam: "SF",
      awayTeam: "KC",
      kickoffAt: new Date(),
    })
    .returning();
  const prices = initialGamePropPrices({ initialProbability: 0.5, vig: 0.08 });
  const [market] = await db
    .insert(markets)
    .values({
      marketType: "GAME_PROP",
      playerId: player.id,
      nflSeason: 2026,
      nflWeek: 3,
      gameId: game.id,
      statCategory: "receiving_yards",
      thresholdValue: threshold,
      comparator: "OVER",
      pricingModel: "game-prop-fixed-odds-v1",
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
  return { player, game, market, over, under };
}

describe("buy -> lock -> settle (game props)", () => {
  beforeEach(async () => {
    await db.delete(trades);
    await db.delete(ledgerEntries);
    await db.delete(positions);
    await db.delete(settlements);
    await db.delete(contracts);
    await db.delete(markets);
    await db.delete(nflGames);
    await db.delete(players);
    await db.delete(wallets);
    await db.delete(users);
  });

  it("pays out the winning side and marks losing positions settled with no payout", async () => {
    const userId = await seedUserWithBonus();
    const { market, game, player, over, under } = await seedGamePropMarket(74.5);

    const overBuy = await buyContract(userId, over.id, 10);
    const underBuy = await buyContract(userId, under.id, 4);
    const [walletAfterBuys] = await db.select().from(wallets).where(eq(wallets.userId, userId));

    const statsFeed = createMockStatsFeedClient({
      gameStatuses: { [game.id]: "FINAL" },
      playerGameStats: { [`${player.id}:${game.id}:receiving_yards`]: 80 },
    });

    const results = await runGamePropSettlements(statsFeed);
    expect(results).toContainEqual({ marketId: market.id, outcome: "SETTLED" });

    const [settledMarket] = await db.select().from(markets).where(eq(markets.id, market.id));
    expect(settledMarket.status).toBe("SETTLED");

    const [settlementRow] = await db.select().from(settlements).where(eq(settlements.marketId, market.id));
    expect(settlementRow.payouts).toEqual({ [over.id]: 1, [under.id]: 0 });
    expect(settlementRow.resolutionSource).toBe("STATS_FEED");
    expect(settlementRow.resolutionData).toMatchObject({ actualValue: 80 });

    const allPositions = await db.select().from(positions).where(eq(positions.marketId, market.id));
    expect(allPositions.every((p) => p.status === "SETTLED")).toBe(true);

    const [wallet] = await db.select().from(wallets).where(eq(wallets.userId, userId));
    // OVER pays 1 x 100 cents x 10 shares = 1000; UNDER pays nothing.
    expect(wallet.balance).toBe(walletAfterBuys.balance + 1000);

    const payoutEntries = await db
      .select()
      .from(ledgerEntries)
      .where(eq(ledgerEntries.walletId, wallet.id));
    expect(payoutEntries.filter((e) => e.type === "SETTLEMENT_PAYOUT")).toHaveLength(1);

    expect(overBuy.marketId).toBe(market.id);
    expect(underBuy.marketId).toBe(market.id);
  });

  it("voids the market and refunds each position's own stake on a push", async () => {
    const userId = await seedUserWithBonus();
    const { market, game, player, over } = await seedGamePropMarket(74.5);

    const buy = await buyContract(userId, over.id, 6);
    const [walletAfterBuy] = await db.select().from(wallets).where(eq(wallets.userId, userId));

    const statsFeed = createMockStatsFeedClient({
      gameStatuses: { [game.id]: "FINAL" },
      playerGameStats: { [`${player.id}:${game.id}:receiving_yards`]: 74.5 },
    });

    const results = await runGamePropSettlements(statsFeed);
    expect(results).toContainEqual({ marketId: market.id, outcome: "PUSH" });

    const [voidedMarket] = await db.select().from(markets).where(eq(markets.id, market.id));
    expect(voidedMarket.status).toBe("VOID");

    expect(await db.select().from(settlements).where(eq(settlements.marketId, market.id))).toHaveLength(0);

    const [position] = await db
      .select()
      .from(positions)
      .where(eq(positions.marketId, market.id));
    expect(position.status).toBe("VOIDED");

    const [wallet] = await db.select().from(wallets).where(eq(wallets.userId, userId));
    const expectedRefund = Math.round(position.avgEntryPrice * 100) * position.quantity;
    expect(wallet.balance).toBe(walletAfterBuy.balance + expectedRefund);
    expect(buy.tradeId).toBeTruthy();
  });

  it("skips markets whose game hasn't gone FINAL yet", async () => {
    const { market, game } = await seedGamePropMarket();
    const statsFeed = createMockStatsFeedClient({ gameStatuses: { [game.id]: "IN_PROGRESS" }, playerGameStats: {} });

    const results = await runGamePropSettlements(statsFeed);
    expect(results).toContainEqual({ marketId: market.id, outcome: "SKIPPED_NOT_FINAL" });

    const [unchangedMarket] = await db.select().from(markets).where(eq(markets.id, market.id));
    expect(unchangedMarket.status).toBe("OPEN");
  });

  it("is safe to re-run — an already-settled market is excluded on the next pass", async () => {
    const { market, game, player } = await seedGamePropMarket(74.5);
    const statsFeed = createMockStatsFeedClient({
      gameStatuses: { [game.id]: "FINAL" },
      playerGameStats: { [`${player.id}:${game.id}:receiving_yards`]: 80 },
    });

    await runGamePropSettlements(statsFeed);
    const secondRun = await runGamePropSettlements(statsFeed);
    expect(secondRun.find((r) => r.marketId === market.id)).toBeUndefined();
  });
});
