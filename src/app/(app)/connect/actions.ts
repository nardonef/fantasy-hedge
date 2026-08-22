"use server";

import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { providerAccounts, users } from "@/db/schema";
import { ingestLeagueBundle } from "@/lib/ingest-league-bundle";
import {
  createHttpSleeperApi,
  fetchSleeperLeagueBundle,
  fetchSleeperUserLeagueIds,
  resolveSleeperUserId,
} from "@/providers/sleeper";

async function requireDbUser() {
  const { userId: clerkId } = await auth();
  if (!clerkId) throw new Error("Not signed in");
  const [dbUser] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (!dbUser) throw new Error("No local user record yet — try signing out and back in");
  return dbUser;
}

const CURRENT_NFL_SEASON = new Date().getFullYear();

export async function connectSleeper(username: string): Promise<{ leaguesSynced: number }> {
  const trimmed = username.trim();
  if (!trimmed) throw new Error("Enter a Sleeper username");

  const dbUser = await requireDbUser();
  const api = createHttpSleeperApi();
  const sleeperUserId = await resolveSleeperUserId(api, trimmed);

  const [account] = await db
    .insert(providerAccounts)
    .values({ userId: dbUser.id, provider: "sleeper", providerUserId: sleeperUserId })
    .onConflictDoUpdate({
      target: [providerAccounts.provider, providerAccounts.providerUserId],
      set: { userId: dbUser.id, updatedAt: new Date() },
    })
    .returning();

  const leagueIds = await fetchSleeperUserLeagueIds(api, sleeperUserId, CURRENT_NFL_SEASON);
  for (const leagueId of leagueIds) {
    const bundle = await fetchSleeperLeagueBundle(api, leagueId, sleeperUserId);
    await ingestLeagueBundle(account.id, bundle);
  }

  revalidatePath("/connect");
  return { leaguesSynced: leagueIds.length };
}
