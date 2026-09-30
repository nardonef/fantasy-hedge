import { auth } from "@clerk/nextjs/server";
import { eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { type MarketType, markets, players } from "@/db/schema";
import { comparatorSymbol } from "@/lib/comparator";

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
  const openCount = openMarkets.filter(({ market }) => market.status === "OPEN").length;

  return (
    <div className="mx-auto flex max-w-3xl flex-1 flex-col gap-10 px-10 py-12">
      <div className="flex flex-col gap-3">
        <p className="kicker text-hedge">{openCount} open</p>
        <h1 className="text-[56px] font-semibold leading-[0.95] tracking-[-0.05em]">Markets</h1>
      </div>
      {SECTIONS.map((section) => {
        const rows = byType.get(section.type) ?? [];
        return (
          <section key={section.type} className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-xl font-semibold tracking-[-0.025em]">{section.title}</h2>
              <p className="text-sm text-chalk-faint">{section.description}</p>
            </div>
            {rows.length === 0 ? (
              <p className="border-b border-hairline py-4 text-sm text-chalk-faint">
                No open markets right now.
              </p>
            ) : (
              <ul className="border-t border-hairline">
                {rows.map(({ market, playerName }) => (
                  <li key={market.id}>
                    <Link
                      href={`/markets/${market.id}`}
                      className="grid grid-cols-[1fr_auto_20px] items-center gap-[18px] border-b border-hairline px-3 py-3.5 hover:bg-[#0c0c0f]"
                    >
                      <div className="flex flex-col gap-1">
                        <span className="text-base font-semibold">{playerName}</span>
                        <span className="font-mono text-xs text-chalk-dim">
                          {market.statCategory} · {comparatorSymbol(market.comparator)} {market.thresholdValue}
                        </span>
                      </div>
                      <span
                        className={`pill ${
                          market.status === "OPEN"
                            ? "border-hedge/35 text-hedge"
                            : "border-chalk-faintest text-chalk-faint"
                        }`}
                      >
                        {market.status}
                      </span>
                      <span aria-hidden className="text-chalk-muted">
                        →
                      </span>
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
