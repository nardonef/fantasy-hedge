import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { draftPicks, leagues, providerAccounts, rosterEntries } from "@/db/schema";
import type { NormalizedLeagueBundle } from "@/providers/types";
import { resolvePlayer } from "./players";

/**
 * Persists one connected league's normalized bundle: upserts the league row, resolves every
 * referenced player to a global players row (creating one if needed), then replaces the
 * league's roster entries and draft picks. Idempotent — re-running with the same bundle
 * produces the same rows, keyed by (provider, providerLeagueId, season) for the league and
 * by (leagueId, providerPlayerId) / (leagueId, pickNo) for its children.
 */
export async function ingestLeagueBundle(
  providerAccountId: string,
  bundle: NormalizedLeagueBundle,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [league] = await tx
      .insert(leagues)
      .values({
        providerAccountId,
        provider: bundle.league.provider,
        providerLeagueId: bundle.league.providerLeagueId,
        season: bundle.league.season,
        name: bundle.league.name,
        totalTeams: bundle.league.totalTeams,
        raw: bundle.league.raw,
      })
      .onConflictDoUpdate({
        target: [leagues.provider, leagues.providerLeagueId, leagues.season],
        set: {
          name: bundle.league.name,
          totalTeams: bundle.league.totalTeams,
          raw: bundle.league.raw,
          syncedAt: new Date(),
        },
      })
      .returning();

    const playerIdByProviderPlayerId = new Map<string, string>();
    for (const player of bundle.players) {
      const playerId = await resolvePlayer(tx, bundle.league.provider, player);
      playerIdByProviderPlayerId.set(player.providerPlayerId, playerId);
    }

    for (const entry of bundle.rosterEntries) {
      await tx
        .insert(rosterEntries)
        .values({
          leagueId: league.id,
          playerId: playerIdByProviderPlayerId.get(entry.providerPlayerId) ?? null,
          providerPlayerId: entry.providerPlayerId,
          slot: entry.slot,
        })
        .onConflictDoUpdate({
          target: [rosterEntries.leagueId, rosterEntries.providerPlayerId],
          set: {
            playerId: playerIdByProviderPlayerId.get(entry.providerPlayerId) ?? null,
            slot: entry.slot,
            syncedAt: new Date(),
          },
        });
    }

    for (const pick of bundle.draftPicks) {
      await tx
        .insert(draftPicks)
        .values({
          leagueId: league.id,
          playerId: pick.providerPlayerId
            ? (playerIdByProviderPlayerId.get(pick.providerPlayerId) ?? null)
            : null,
          providerPlayerId: pick.providerPlayerId,
          round: pick.round,
          pickNo: pick.pickNo,
          isKeeper: pick.isKeeper,
          amount: pick.amount,
        })
        .onConflictDoUpdate({
          target: [draftPicks.leagueId, draftPicks.pickNo],
          set: {
            playerId: pick.providerPlayerId
              ? (playerIdByProviderPlayerId.get(pick.providerPlayerId) ?? null)
              : null,
            providerPlayerId: pick.providerPlayerId,
            round: pick.round,
            isKeeper: pick.isKeeper,
            amount: pick.amount,
          },
        });
    }
  });
}

/** The user's connected provider account for this provider, if any. */
export async function findProviderAccount(userId: string, provider: "sleeper" | "yahoo") {
  const [account] = await db
    .select()
    .from(providerAccounts)
    .where(and(eq(providerAccounts.userId, userId), eq(providerAccounts.provider, provider)))
    .limit(1);
  return account ?? null;
}
