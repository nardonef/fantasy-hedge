/**
 * Data source for Sleeper payloads. Sleeper's fantasy API is public and read-only — no
 * OAuth, just a username lookup. Both HTTP and fixture implementations return raw JSON;
 * validation happens in normalize.ts.
 */
export interface SleeperApi {
  getUser(usernameOrId: string): Promise<unknown>;
  getUserLeagues(userId: string, season: number): Promise<unknown>;
  getLeague(leagueId: string): Promise<unknown>;
  getRosters(leagueId: string): Promise<unknown>;
  getDrafts(leagueId: string): Promise<unknown>;
  getDraftPicks(draftId: string): Promise<unknown>;
  getPlayers(): Promise<unknown>;
}

const BASE_URL = "https://api.sleeper.app/v1";
const MAX_ATTEMPTS = 4;

async function fetchJson(url: string): Promise<unknown> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, { headers: { accept: "application/json" } });
      if (res.status === 429 || res.status >= 500) {
        lastError = new Error(`Sleeper ${res.status} for ${url}`);
      } else if (!res.ok) {
        throw new Error(`Sleeper ${res.status} for ${url}`);
      } else {
        return await res.json();
      }
    } catch (error) {
      lastError = error;
    }
    await new Promise((r) => setTimeout(r, 500 * 2 ** (attempt - 1)));
  }
  throw lastError instanceof Error ? lastError : new Error(`Failed to fetch ${url}`);
}

export function createHttpSleeperApi(): SleeperApi {
  return {
    getUser: (u) => fetchJson(`${BASE_URL}/user/${u}`),
    getUserLeagues: (userId, season) =>
      fetchJson(`${BASE_URL}/user/${userId}/leagues/nfl/${season}`),
    getLeague: (id) => fetchJson(`${BASE_URL}/league/${id}`),
    getRosters: (id) => fetchJson(`${BASE_URL}/league/${id}/rosters`),
    getDrafts: (id) => fetchJson(`${BASE_URL}/league/${id}/drafts`),
    getDraftPicks: (draftId) => fetchJson(`${BASE_URL}/draft/${draftId}/picks`),
    getPlayers: () => fetchJson(`${BASE_URL}/players/nfl`),
  };
}
