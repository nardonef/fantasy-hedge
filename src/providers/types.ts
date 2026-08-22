import type { Provider } from "@/db/schema";

/**
 * Provider-agnostic representation of one connected user's league-season. Adapters are the
 * only code that sees provider-shaped data; everything downstream (persistence, pricing)
 * consumes this. Deliberately trimmed to "what do I need to hedge" — current roster and
 * draft position — not full league history (standings, matchups, transactions), since
 * markets are global and hedge value comes from real NFL outcomes, not league scoring.
 */
export type NormalizedLeagueBundle = {
  league: {
    provider: Provider;
    providerLeagueId: string;
    season: number;
    name: string;
    totalTeams: number | null;
    raw: unknown;
  };
  rosterEntries: NormalizedRosterEntry[];
  draftPicks: NormalizedDraftPick[];
  players: NormalizedPlayer[];
};

export type NormalizedRosterEntry = {
  providerPlayerId: string;
  /** STARTER | BENCH | IR | TAXI */
  slot: string;
};

export type NormalizedDraftPick = {
  round: number;
  pickNo: number;
  providerPlayerId: string | null;
  isKeeper: boolean;
  amount: number | null;
};

export type NormalizedPlayer = {
  providerPlayerId: string;
  name: string;
  position: string | null;
  nflTeam: string | null;
};
