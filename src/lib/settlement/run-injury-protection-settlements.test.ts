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
const { injuryProtectionPrices } = await import("@/lib/pricing/injury-protection-pricing");
const { buyContract } = await import("@/lib/trading");
const { grantSignupBonus } = await import("@/lib/wallet");
const { createMockStatsFeedClient } = await import("@/lib/stats-feed/mock-client");
const { runInjuryProtectionSettlements } = await import("./run-injury-protection-settlements");

async function seedUserWithBonus() {
  const [user] = await db
    .insert(users)
    .values({ clerkId: `clerk-${crypto.randomUUID()}`, email: `${crypto.randomUUID()}@example.com` })
    .returning();
  await grantSignupBonus(user.id);
  return user.id;
}

async function seedInjuryProtectionMarket() {
  const [player] = await db
    .insert(players)
    .values({ name: "Durable Back", normalizedName: "durable back", position: "RB", nflTeam: "KC" })
    .returning();
  const prices = injuryProtectionPrices({ position: "RB", riskMultiplier: 1, vig: 0.08 });
  const [market] = await db
    .insert(markets)
    .values({
      marketType: "INJURY_PROTECTION",
      playerId: player.id,
      nflSeason: 2026,
      statCategory: "games_missed",
      // Tier boundaries live in the fixed INJURY_TIERS logic in settlement, not this field —
      // thresholdValue/comparator are required by the schema but not read for this market type.
      thresholdValue: 0,
      comparator: "AT_LEAST",
      pricingModel: "injury-risk-table-v1",
      closesAt: new Date(),
    })
    .returning();
  const contractRows = await db
    .insert(contracts)
    .values([
      { marketId: market.id, label: "ZERO_GAMES", currentPrice: prices.ZERO_GAMES },
      { marketId: market.id, label: "ONE_TO_TWO_GAMES", currentPrice: prices.ONE_TO_TWO_GAMES },
      { marketId: market.id, label: "THREE_PLUS_GAMES", currentPrice: prices.THREE_PLUS_GAMES },
    ])
    .returning();
  return { player, market, contracts: contractRows };
}

describe("buy -> settle (injury protection)", () => {
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

  it("pays out the winning tier and settles the other two with no payout", async () => {
    const userId = await seedUserWithBonus();
    const { market, player, contracts: marketContracts } = await seedInjuryProtectionMarket();
    const oneToTwo = marketContracts.find((c) => c.label === "ONE_TO_TWO_GAMES");
    if (!oneToTwo) throw new Error("missing contract");

    await buyContract(userId, oneToTwo.id, 8);
    const [walletAfterBuy] = await db.select().from(wallets).where(eq(wallets.userId, userId));

    const statsFeed = createMockStatsFeedClient({
      seasonComplete: { 2026: true },
      playerGamesMissed: { [`${player.id}:2026`]: 2 },
    });

    const results = await runInjuryProtectionSettlements(statsFeed);
    expect(results).toContainEqual({ marketId: market.id, outcome: "SETTLED" });

    const [settledMarket] = await db.select().from(markets).where(eq(markets.id, market.id));
    expect(settledMarket.status).toBe("SETTLED");

    const [settlementRow] = await db.select().from(settlements).where(eq(settlements.marketId, market.id));
    expect(settlementRow.resolutionData).toMatchObject({ gamesMissed: 2 });

    const [wallet] = await db.select().from(wallets).where(eq(wallets.userId, userId));
    // ONE_TO_TWO_GAMES pays 1 x 100 cents x 8 shares = 800.
    expect(wallet.balance).toBe(walletAfterBuy.balance + 800);

    const allPositions = await db.select().from(positions).where(eq(positions.marketId, market.id));
    expect(allPositions.every((p) => p.status === "SETTLED")).toBe(true);
  });

  it("pays nothing when the held tier loses", async () => {
    const userId = await seedUserWithBonus();
    const { market, player, contracts: marketContracts } = await seedInjuryProtectionMarket();
    const zeroGames = marketContracts.find((c) => c.label === "ZERO_GAMES");
    if (!zeroGames) throw new Error("missing contract");

    await buyContract(userId, zeroGames.id, 5);
    const [walletAfterBuy] = await db.select().from(wallets).where(eq(wallets.userId, userId));

    const statsFeed = createMockStatsFeedClient({
      seasonComplete: { 2026: true },
      playerGamesMissed: { [`${player.id}:2026`]: 5 },
    });

    await runInjuryProtectionSettlements(statsFeed);

    const [wallet] = await db.select().from(wallets).where(eq(wallets.userId, userId));
    expect(wallet.balance).toBe(walletAfterBuy.balance);
    expect(market.id).toBeTruthy();
  });

  it("skips markets whose season hasn't ended yet", async () => {
    const { market } = await seedInjuryProtectionMarket();
    const statsFeed = createMockStatsFeedClient({ seasonComplete: { 2026: false } });

    const results = await runInjuryProtectionSettlements(statsFeed);
    expect(results).toContainEqual({ marketId: market.id, outcome: "SKIPPED_NOT_FINAL" });
  });
});
