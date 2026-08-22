import type { NormalizedLeagueBundle } from "@/providers/types";
import type { YahooApi } from "./client";
import {
  extractDraftPicks,
  extractLeaguesAndOwnTeams,
  extractRosterPlayers,
  normalizeYahooLeague,
} from "./normalize";

export { createHttpYahooApi } from "./client";
export type { YahooApi } from "./client";
export { extractDraftPicks, extractLeaguesAndOwnTeams, extractRosterPlayers, normalizeYahooLeague } from "./normalize";

/** Fetches and normalizes every current-season league the connected Yahoo user has a team in. */
export async function fetchYahooLeagueBundles(api: YahooApi): Promise<NormalizedLeagueBundle[]> {
  const leagues = extractLeaguesAndOwnTeams(await api.getUserLeaguesAndTeams());

  return Promise.all(
    leagues.map(async (league) => {
      const [rosterRaw, draftRaw] = await Promise.all([
        api.getTeamRoster(league.ownTeamKey),
        api.getTeamDraftResults(league.ownTeamKey),
      ]);
      return normalizeYahooLeague(
        league,
        extractRosterPlayers(rosterRaw),
        extractDraftPicks(draftRaw),
      );
    }),
  );
}
