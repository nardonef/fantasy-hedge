import "dotenv/config";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { contracts, markets, nflGames, players } from "@/db/schema";
import { initialGamePropPrices } from "@/lib/pricing/game-prop-pricing";
import { normalizePlayerName } from "@/lib/players";

const DEMO_PLAYERS = [
  { name: "Demo WR One", position: "WR", nflTeam: "SF" },
  { name: "Demo RB One", position: "RB", nflTeam: "KC" },
];

const DEMO_GAME = {
  season: 2026,
  week: 3,
  homeTeam: "SF",
  awayTeam: "KC",
  kickoffAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
};

const DEMO_MARKETS = [
  { playerName: "Demo WR One", statCategory: "receiving_yards", thresholdValue: 74.5, initialProbability: 0.5 },
  { playerName: "Demo RB One", statCategory: "rushing_yards", thresholdValue: 59.5, initialProbability: 0.55 },
];

const VIG = 0.08;

async function findOrCreatePlayer(name: string, position: string, nflTeam: string) {
  const normalizedName = normalizePlayerName(name);
  const [existing] = await db.select().from(players).where(eq(players.normalizedName, normalizedName)).limit(1);
  if (existing) return existing;

  const [created] = await db.insert(players).values({ name, normalizedName, position, nflTeam }).returning();
  return created;
}

async function findOrCreateGame() {
  const [existing] = await db
    .select()
    .from(nflGames)
    .where(
      and(
        eq(nflGames.season, DEMO_GAME.season),
        eq(nflGames.week, DEMO_GAME.week),
        eq(nflGames.homeTeam, DEMO_GAME.homeTeam),
        eq(nflGames.awayTeam, DEMO_GAME.awayTeam),
      ),
    )
    .limit(1);
  if (existing) return existing;

  const [created] = await db.insert(nflGames).values(DEMO_GAME).returning();
  return created;
}

async function main() {
  for (const p of DEMO_PLAYERS) {
    await findOrCreatePlayer(p.name, p.position, p.nflTeam);
  }
  const game = await findOrCreateGame();

  for (const spec of DEMO_MARKETS) {
    const normalizedName = normalizePlayerName(spec.playerName);
    const [player] = await db.select().from(players).where(eq(players.normalizedName, normalizedName)).limit(1);
    if (!player) throw new Error(`Player not found: ${spec.playerName}`);

    const [existingMarket] = await db
      .select()
      .from(markets)
      .where(
        and(
          eq(markets.playerId, player.id),
          eq(markets.gameId, game.id),
          eq(markets.statCategory, spec.statCategory),
        ),
      )
      .limit(1);
    if (existingMarket) {
      console.log(`Skipping existing market for ${spec.playerName} / ${spec.statCategory}`);
      continue;
    }

    const prices = initialGamePropPrices({ initialProbability: spec.initialProbability, vig: VIG });

    const [market] = await db
      .insert(markets)
      .values({
        marketType: "GAME_PROP",
        playerId: player.id,
        nflSeason: DEMO_GAME.season,
        nflWeek: DEMO_GAME.week,
        gameId: game.id,
        statCategory: spec.statCategory,
        thresholdValue: spec.thresholdValue,
        comparator: "OVER",
        pricingModel: "game-prop-fixed-odds-v1",
        pricingParams: { initialProbability: spec.initialProbability, vig: VIG },
        closesAt: DEMO_GAME.kickoffAt,
      })
      .returning();

    await db.insert(contracts).values([
      { marketId: market.id, label: "OVER", currentPrice: prices.OVER },
      { marketId: market.id, label: "UNDER", currentPrice: prices.UNDER },
    ]);

    console.log(`Seeded market ${market.id} — ${spec.playerName} ${spec.statCategory} O/U ${spec.thresholdValue}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
