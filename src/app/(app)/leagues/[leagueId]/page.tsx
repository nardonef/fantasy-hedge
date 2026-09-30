import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { db } from "@/db/client";
import { leagues, players, providerAccounts, rosterEntries, users } from "@/db/schema";

export default async function LeaguePage({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in");

  const { leagueId } = await params;

  const [row] = await db
    .select({ league: leagues, ownerClerkId: users.clerkId })
    .from(leagues)
    .innerJoin(providerAccounts, eq(leagues.providerAccountId, providerAccounts.id))
    .innerJoin(users, eq(providerAccounts.userId, users.id))
    .where(eq(leagues.id, leagueId))
    .limit(1);

  if (!row || row.ownerClerkId !== clerkId) notFound();

  const roster = await db
    .select({
      providerPlayerId: rosterEntries.providerPlayerId,
      slot: rosterEntries.slot,
      name: players.name,
      position: players.position,
      nflTeam: players.nflTeam,
    })
    .from(rosterEntries)
    .leftJoin(players, eq(rosterEntries.playerId, players.id))
    .where(eq(rosterEntries.leagueId, leagueId));

  return (
    <div className="mx-auto flex max-w-xl flex-1 flex-col gap-6 px-6 py-12">
      <h1 className="text-4xl font-semibold leading-none tracking-[-0.04em]">
        {row.league.name} ({row.league.provider}, {row.league.season})
      </h1>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-hairline-2">
            <th className="py-2 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-chalk-faint">Player</th>
            <th className="py-2 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-chalk-faint">Pos</th>
            <th className="py-2 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-chalk-faint">Team</th>
            <th className="py-2 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-chalk-faint">Slot</th>
          </tr>
        </thead>
        <tbody>
          {roster.map((r) => (
            <tr key={r.providerPlayerId} className="border-b border-hairline">
              <td className="py-3 font-semibold">{r.name ?? r.providerPlayerId}</td>
              <td className="py-3">
                <span className="rounded-[5px] bg-raised px-2 py-0.5 font-mono text-[11px]">{r.position ?? "—"}</span>
              </td>
              <td className="py-3">
                <span className="rounded-[5px] bg-raised px-2 py-0.5 font-mono text-[11px]">{r.nflTeam ?? "—"}</span>
              </td>
              <td className="py-3 font-mono text-[11px] text-chalk-dim">{r.slot}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
