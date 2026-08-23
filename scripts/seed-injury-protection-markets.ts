import "dotenv/config";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { contracts, markets, players } from "@/db/schema";
import { injuryProtectionPrices } from "@/lib/pricing/injury-protection-pricing";
import { normalizePlayerName } from "@/lib/players";

const SEASON = 2026;
const VIG = 0.08;

const DEMO_MARKETS = [
  { playerName: "Demo Injury RB", position: "RB" as const, nflTeam: "PHI", riskMultiplier: 1 },
  { playerName: "Demo Injury WR", position: "WR" as const, nflTeam: "CIN", riskMultiplier: 1.4 },
];

async function findOrCreatePlayer(name: string, position: string, nflTeam: string) {
  const normalizedName = normalizePlayerName(name);
  const [existing] = await db.select().from(players).where(eq(players.normalizedName, normalizedName)).limit(1);
  if (existing) return existing;

  const [created] = await db.insert(players).values({ name, normalizedName, position, nflTeam }).returning();
  return created;
}

async function main() {
  for (const spec of DEMO_MARKETS) {
    const player = await findOrCreatePlayer(spec.playerName, spec.position, spec.nflTeam);

    const [existingMarket] = await db
      .select()
      .from(markets)
      .where(
        and(
          eq(markets.playerId, player.id),
          eq(markets.marketType, "INJURY_PROTECTION"),
          eq(markets.nflSeason, SEASON),
        ),
      )
      .limit(1);
    if (existingMarket) {
      console.log(`Skipping existing injury-protection market for ${spec.playerName}`);
      continue;
    }

    const prices = injuryProtectionPrices({ position: spec.position, riskMultiplier: spec.riskMultiplier, vig: VIG });

    const [market] = await db
      .insert(markets)
      .values({
        marketType: "INJURY_PROTECTION",
        playerId: player.id,
        nflSeason: SEASON,
        statCategory: "games_missed",
        // Tier boundaries are fixed in settleInjuryProtection, not read from this field — the
        // schema requires a value, so this is a sentinel, not a real threshold for this type.
        thresholdValue: 0,
        comparator: "AT_LEAST",
        pricingModel: "injury-risk-table-v1",
        pricingParams: { riskMultiplier: spec.riskMultiplier, vig: VIG },
        closesAt: new Date(`${SEASON}-09-01T00:00:00Z`),
      })
      .returning();

    await db.insert(contracts).values([
      { marketId: market.id, label: "ZERO_GAMES", currentPrice: prices.ZERO_GAMES },
      { marketId: market.id, label: "ONE_TO_TWO_GAMES", currentPrice: prices.ONE_TO_TWO_GAMES },
      { marketId: market.id, label: "THREE_PLUS_GAMES", currentPrice: prices.THREE_PLUS_GAMES },
    ]);

    console.log(`Seeded market ${market.id} — ${spec.playerName} injury protection`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
