import type { NormalizedDraftPick, NormalizedLeagueBundle, NormalizedPlayer } from "@/providers/types";
import {
  sleeperDraftPicksSchema,
  sleeperDraftsSchema,
  sleeperLeagueSchema,
  sleeperPlayersSchema,
  sleeperRostersSchema,
} from "./schemas";

/** Everything fetched for one league to normalize the connected user's own roster + picks. */
export type SleeperLeaguePayloads = {
  league: unknown;
  rosters: unknown;
  drafts: unknown;
  draftPicksByDraft: Record<string, unknown>;
  players: unknown;
};

function classifySlot(
  playerId: string,
  starters: Set<string>,
  reserve: Set<string>,
  taxi: Set<string>,
): string {
  if (taxi.has(playerId)) return "TAXI";
  if (reserve.has(playerId)) return "IR";
  if (starters.has(playerId)) return "STARTER";
  return "BENCH";
}

/**
 * Normalizes one Sleeper league to the connected user's own roster and draft picks only —
 * `sleeperUserId` is the Sleeper user id of the connected provider account, used to pick out
 * that user's roster among the league's rosters.
 */
export function normalizeSleeperLeague(
  payloads: SleeperLeaguePayloads,
  sleeperUserId: string,
): NormalizedLeagueBundle {
  const league = sleeperLeagueSchema.parse(payloads.league);
  const rosters = sleeperRostersSchema.parse(payloads.rosters);
  const playersDump = sleeperPlayersSchema.parse(payloads.players ?? {});

  const ownRoster = rosters.find((r) => r.owner_id === sleeperUserId);
  if (!ownRoster) {
    throw new Error(`No roster owned by Sleeper user ${sleeperUserId} in league ${league.league_id}`);
  }

  const starters = new Set(ownRoster.starters ?? []);
  const reserve = new Set(ownRoster.reserve ?? []);
  const taxi = new Set(ownRoster.taxi ?? []);
  const referencedPlayerIds = new Set<string>();

  const rosterEntries = (ownRoster.players ?? []).map((playerId) => {
    referencedPlayerIds.add(playerId);
    return {
      providerPlayerId: playerId,
      slot: classifySlot(playerId, starters, reserve, taxi),
    };
  });

  const drafts = sleeperDraftsSchema.parse(payloads.drafts ?? []);
  const draftPicks: NormalizedDraftPick[] = [];
  for (const draft of drafts) {
    const rawPicks = payloads.draftPicksByDraft[draft.draft_id];
    if (rawPicks == null) continue;
    for (const pick of sleeperDraftPicksSchema.parse(rawPicks)) {
      if (pick.roster_id !== ownRoster.roster_id) continue;
      if (pick.player_id) referencedPlayerIds.add(pick.player_id);
      draftPicks.push({
        round: pick.round,
        pickNo: pick.pick_no,
        providerPlayerId: pick.player_id ?? null,
        isKeeper: pick.is_keeper ?? false,
        amount: pick.metadata?.amount ? Number.parseInt(pick.metadata.amount, 10) : null,
      });
    }
  }

  const players: NormalizedPlayer[] = [...referencedPlayerIds].sort().map((playerId) => {
    const p = playersDump[playerId];
    const name = p?.full_name ?? [p?.first_name, p?.last_name].filter(Boolean).join(" ").trim();
    return {
      providerPlayerId: playerId,
      name: name || playerId,
      position: p?.position ?? null,
      nflTeam: p?.team ?? null,
    };
  });

  return {
    league: {
      provider: "sleeper",
      providerLeagueId: league.league_id,
      season: Number.parseInt(league.season, 10),
      name: league.name,
      totalTeams: league.total_rosters,
      raw: payloads.league,
    },
    rosterEntries,
    draftPicks,
    players,
  };
}
