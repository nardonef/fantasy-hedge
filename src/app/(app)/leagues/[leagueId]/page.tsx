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
    <div className="mx-auto flex max-w-xl flex-1 flex-col gap-6 px-6 py-16">
      <h1 className="text-2xl font-semibold">
        {row.league.name} ({row.league.provider}, {row.league.season})
      </h1>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-300 dark:border-zinc-700">
            <th className="py-2">Player</th>
            <th className="py-2">Pos</th>
            <th className="py-2">Team</th>
            <th className="py-2">Slot</th>
          </tr>
        </thead>
        <tbody>
          {roster.map((r) => (
            <tr key={r.providerPlayerId} className="border-b border-zinc-100 dark:border-zinc-800">
              <td className="py-2">{r.name ?? r.providerPlayerId}</td>
              <td className="py-2">{r.position ?? "—"}</td>
              <td className="py-2">{r.nflTeam ?? "—"}</td>
              <td className="py-2">{r.slot}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
