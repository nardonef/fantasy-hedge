import "dotenv/config";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { contracts, markets, players } from "@/db/schema";
import { draftSlotBaseline } from "@/lib/pricing/draft-slot-baselines";
import { projectedSeasonTotal, seasonProductionPrices } from "@/lib/pricing/season-production-pricing";
import { normalizePlayerName } from "@/lib/players";

const SEASON = 2026;
const TOTAL_GAMES = 17;
const VIG = 0.08;
const SENSITIVITY_FRACTION = 0.4; // sensitivity = baseline * this fraction

const DEMO_MARKETS = [
  {
    playerName: "Demo Season WR",
    position: "WR" as const,
    nflTeam: "MIA",
    statCategory: "receiving_yards",
    draftRound: 2,
    gamesPlayed: 3,
    statToDate: 210,
  },
  {
    playerName: "Demo Season RB",
    position: "RB" as const,
    nflTeam: "DAL",
    statCategory: "rushing_yards",
    draftRound: 1,
    gamesPlayed: 3,
    statToDate: 260,
  },
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
          eq(markets.marketType, "SEASON_PRODUCTION"),
          eq(markets.nflSeason, SEASON),
          eq(markets.statCategory, spec.statCategory),
        ),
      )
      .limit(1);
    if (existingMarket) {
      console.log(`Skipping existing market for ${spec.playerName} / ${spec.statCategory}`);
      continue;
    }

    const baseline = draftSlotBaseline(spec.position, spec.statCategory, spec.draftRound);
    const projectedTotal = projectedSeasonTotal({
      gamesPlayed: spec.gamesPlayed,
      totalGames: TOTAL_GAMES,
      statToDate: spec.statToDate,
      baseline,
    });
    // The market's line is the projection itself, rounded to a half — an even-money open.
    const thresholdValue = Math.round(projectedTotal - 0.5) + 0.5;
    const sensitivity = baseline * SENSITIVITY_FRACTION;
    const prices = seasonProductionPrices({ projectedTotal, thresholdValue, sensitivity, vig: VIG });

    const [market] = await db
      .insert(markets)
      .values({
        marketType: "SEASON_PRODUCTION",
        playerId: player.id,
        nflSeason: SEASON,
        statCategory: spec.statCategory,
        thresholdValue,
        comparator: "OVER",
        pricingModel: "season-production-baseline-v1",
        pricingParams: { baseline, projectedTotal, sensitivity, vig: VIG },
        closesAt: new Date(`${SEASON}-12-31T23:59:59Z`),
      })
      .returning();

    await db.insert(contracts).values([
      { marketId: market.id, label: "OVER", currentPrice: prices.OVER },
      { marketId: market.id, label: "UNDER", currentPrice: prices.UNDER },
    ]);

    console.log(
      `Seeded market ${market.id} — ${spec.playerName} ${spec.statCategory} full-season O/U ${thresholdValue}`,
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
