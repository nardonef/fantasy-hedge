/**
 * Data source for Yahoo Fantasy Sports payloads. Yahoo's API is XML-native; ?format=json
 * gets JSON, but it's XML converted mechanically — arrays become objects keyed "0","1",...
 * with a numeric "count" field. Callers get raw `unknown` back; extraction/validation
 * happens in normalize.ts, which walks this shape defensively.
 */
export interface YahooApi {
  /** The logged-in user's own leagues + own team for the current NFL season. */
  getUserLeaguesAndTeams(): Promise<unknown>;
  getTeamRoster(teamKey: string): Promise<unknown>;
  getTeamDraftResults(teamKey: string): Promise<unknown>;
}

const YAHOO_API = "https://fantasysports.yahooapis.com/fantasy/v2";

async function yahooFetch(path: string, accessToken: string): Promise<unknown> {
  const res = await fetch(`${YAHOO_API}${path}?format=json`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 401) {
    throw new Error("Yahoo OAuth token expired — refresh required");
  }
  if (!res.ok) throw new Error(`Yahoo API error: ${res.status} ${path}`);
  return res.json();
}

export function createHttpYahooApi(accessToken: string): YahooApi {
  return {
    // game_keys=nfl (not game_codes) scopes to the current season only.
    getUserLeaguesAndTeams: () =>
      yahooFetch("/users;use_login=1/games;game_keys=nfl/leagues/teams", accessToken),
    getTeamRoster: (teamKey) => yahooFetch(`/team/${teamKey}/roster`, accessToken),
    getTeamDraftResults: (teamKey) => yahooFetch(`/team/${teamKey}/draftresults`, accessToken),
  };
}
