import { auth } from "@clerk/nextjs/server";
import { eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { type MarketType, markets, players } from "@/db/schema";

const SECTIONS: { type: MarketType; title: string; description: string }[] = [
  { type: "GAME_PROP", title: "Single-game player props", description: "Hedge tonight's matchup" },
  { type: "SEASON_PRODUCTION", title: "Season-long production", description: "Hedge a draft pick's full season" },
  { type: "INJURY_PROTECTION", title: "Injury protection", description: "Hedge games missed to injury" },
];

export default async function MarketsPage() {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in");

  const openMarkets = await db
    .select({ market: markets, playerName: players.name })
    .from(markets)
    .innerJoin(players, eq(markets.playerId, players.id))
    .where(inArray(markets.status, ["OPEN", "LOCKED"]));

  const byType = new Map<MarketType, typeof openMarkets>();
  for (const row of openMarkets) {
    const list = byType.get(row.market.marketType) ?? [];
    list.push(row);
    byType.set(row.market.marketType, list);
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-1 flex-col gap-10 px-6 py-16">
      <h1 className="text-2xl font-semibold">Markets</h1>
      {SECTIONS.map((section) => {
        const rows = byType.get(section.type) ?? [];
        return (
          <section key={section.type} className="flex flex-col gap-3">
            <div>
              <h2 className="font-medium">{section.title}</h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">{section.description}</p>
            </div>
            {rows.length === 0 ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">No open markets right now.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {rows.map(({ market, playerName }) => (
                  <li key={market.id}>
                    <Link href={`/markets/${market.id}`} className="underline">
                      {playerName} — {market.statCategory} {market.comparator} {market.thresholdValue}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
