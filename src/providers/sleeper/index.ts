import type { NormalizedLeagueBundle } from "@/providers/types";
import type { SleeperApi } from "./client";
import { normalizeSleeperLeague, type SleeperLeaguePayloads } from "./normalize";
import { sleeperDraftsSchema, sleeperUserLeaguesSchema, sleeperUserSchema } from "./schemas";

export { createHttpSleeperApi } from "./client";
export type { SleeperApi } from "./client";
export { normalizeSleeperLeague } from "./normalize";
export { sleeperUserSchema } from "./schemas";

/** Looks up the Sleeper user id for a username — this is what gets stored as providerUserId. */
export async function resolveSleeperUserId(api: SleeperApi, username: string): Promise<string> {
  const user = sleeperUserSchema.parse(await api.getUser(username));
  return user.user_id;
}

/** Lists the leagues a Sleeper user is in for a given NFL season. */
export async function fetchSleeperUserLeagueIds(
  api: SleeperApi,
  sleeperUserId: string,
  season: number,
): Promise<string[]> {
  const leagues = sleeperUserLeaguesSchema.parse(await api.getUserLeagues(sleeperUserId, season));
  return leagues.map((l) => l.league_id);
}

async function fetchSleeperPayloads(api: SleeperApi, leagueId: string): Promise<SleeperLeaguePayloads> {
  const [league, rosters, drafts, players] = await Promise.all([
    api.getLeague(leagueId),
    api.getRosters(leagueId),
    api.getDrafts(leagueId),
    api.getPlayers(),
  ]);

  const draftPicksByDraft: Record<string, unknown> = {};
  for (const draft of sleeperDraftsSchema.parse(drafts ?? [])) {
    draftPicksByDraft[draft.draft_id] = await api.getDraftPicks(draft.draft_id);
  }

  return { league, rosters, drafts, draftPicksByDraft, players };
}

export async function fetchSleeperLeagueBundle(
  api: SleeperApi,
  leagueId: string,
  sleeperUserId: string,
): Promise<NormalizedLeagueBundle> {
  return normalizeSleeperLeague(await fetchSleeperPayloads(api, leagueId), sleeperUserId);
}
