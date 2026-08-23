import { eq, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { contracts, markets, players } from "@/db/schema";
import { requireAdmin } from "@/lib/admin";
import { SettleForm } from "./settle-form";

export default async function AdminSettlementsPage() {
  try {
    await requireAdmin();
  } catch {
    redirect("/");
  }

  const openMarkets = await db
    .select({ market: markets, playerName: players.name })
    .from(markets)
    .innerJoin(players, eq(markets.playerId, players.id))
    .where(inArray(markets.status, ["OPEN", "LOCKED"]));

  const allContracts =
    openMarkets.length === 0
      ? []
      : await db
          .select()
          .from(contracts)
          .where(inArray(contracts.marketId, openMarkets.map(({ market }) => market.id)));

  return (
    <div className="mx-auto flex max-w-2xl flex-1 flex-col gap-6 px-6 py-16">
      <div>
        <h1 className="text-2xl font-semibold">Manual settlement override</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Settle or void a market by hand — for when the automated stats feed can't resolve it, or
          you don't trust its result (e.g. the injury-protection games-missed proxy).
        </p>
      </div>
      {openMarkets.length === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">No open markets.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {openMarkets.map(({ market, playerName }) => (
            <li key={market.id} className="flex flex-col gap-2">
              <p className="font-medium">
                {playerName} — {market.marketType} — {market.statCategory}
              </p>
              <SettleForm
                marketId={market.id}
                contracts={allContracts
                  .filter((c) => c.marketId === market.id)
                  .map((c) => ({ id: c.id, label: c.label }))}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
