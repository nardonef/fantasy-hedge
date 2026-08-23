import { eq } from "drizzle-orm";
import type { Executor } from "@/db/executor";
import type { Provider } from "@/db/schema";
import { playerExternalIds, players } from "@/db/schema";
import type { NormalizedPlayer } from "@/providers/types";

/** Lowercased, punctuation-stripped — the reconciliation key across providers. */
export function normalizePlayerName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Resolves a provider's player to a global players row, creating one if needed. Reconciles
 * across providers by exact normalized-name match — a player's providerPlayerId space is
 * different per provider (Sleeper: numeric id, Yahoo: player_key), so this is the join point
 * a user connecting both providers needs.
 */
export async function resolvePlayer(
  executor: Executor,
  provider: Provider,
  player: NormalizedPlayer,
): Promise<string> {
  const [existingExternalId] = await executor
    .select({ playerId: playerExternalIds.playerId })
    .from(playerExternalIds)
    .where(eq(playerExternalIds.providerPlayerId, player.providerPlayerId))
    .limit(1);
  if (existingExternalId) return existingExternalId.playerId;

  const normalizedName = normalizePlayerName(player.name);
  const [byName] = await executor
    .select({ id: players.id })
    .from(players)
    .where(eq(players.normalizedName, normalizedName))
    .limit(1);

  const playerId =
    byName?.id ??
    (
      await executor
        .insert(players)
        .values({
          name: player.name,
          normalizedName,
          position: player.position,
          nflTeam: player.nflTeam,
        })
        .returning({ id: players.id })
    )[0].id;

  await executor
    .insert(playerExternalIds)
    .values({ playerId, provider, providerPlayerId: player.providerPlayerId })
    .onConflictDoNothing();

  return playerId;
}
