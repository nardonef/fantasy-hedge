"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { providerAccounts } from "@/db/schema";
import { type ActionResult, toActionResult } from "@/lib/action-result";
import { requireDbUser } from "@/lib/current-user";
import { ingestLeagueBundle } from "@/lib/ingest-league-bundle";
import {
  createHttpSleeperApi,
  fetchSleeperLeagueBundle,
  fetchSleeperUserLeagueIds,
  resolveSleeperUserId,
} from "@/providers/sleeper";

const CURRENT_NFL_SEASON = new Date().getFullYear();

export async function connectSleeper(username: string): Promise<ActionResult<{ leaguesSynced: number }>> {
  return toActionResult(async () => {
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
  });
}
