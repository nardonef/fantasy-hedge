import type { NormalizedDraftPick, NormalizedLeagueBundle, NormalizedPlayer } from "@/providers/types";
import {
  type YahooDraftPickDto,
  type YahooLeagueDto,
  type YahooRosterPlayerDto,
  yahooDraftPickDtoSchema,
  yahooLeagueDtoSchema,
  yahooRosterPlayerDtoSchema,
} from "./schemas";

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

function isRecord(v: unknown): v is Record<string, Json> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isArray(v: unknown): v is Json[] {
  return Array.isArray(v);
}

function str(v: Json | undefined): string | null {
  return typeof v === "string" ? v : null;
}

function num(v: Json | undefined): number | null {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v !== "" && !Number.isNaN(Number(v))) return Number(v);
  return null;
}

/** Yahoo's XML→JSON conversion represents ordered collections as {"0":..,"1":..,"count":n}. */
function numberedEntries(container: Json | undefined): Json[] {
  if (!isRecord(container)) return [];
  const count = typeof container.count === "number" ? container.count : 0;
  const entries: Json[] = [];
  for (let i = 0; i < count; i++) {
    const entry = container[String(i)];
    if (entry !== undefined) entries.push(entry);
  }
  return entries;
}

/**
 * Extracts the logged-in user's leagues and own team_key from the response to
 * GET /users;use_login=1/games;game_keys=nfl/leagues/teams.
 */
export function extractLeaguesAndOwnTeams(raw: unknown): YahooLeagueDto[] {
  const dtos: YahooLeagueDto[] = [];
  if (!isRecord(raw)) return dtos;
  const fantasyContent = raw.fantasy_content;
  if (!isRecord(fantasyContent)) return dtos;
  const users = fantasyContent.users;
  if (!isRecord(users)) return dtos;

  for (const userEntry of numberedEntries(users)) {
    if (!isRecord(userEntry) || !isArray(userEntry.user)) continue;
    const games = userEntry.user[1];
    if (!isRecord(games) || !isRecord(games.games)) continue;

    for (const gameEntry of numberedEntries(games.games)) {
      if (!isRecord(gameEntry) || !isArray(gameEntry.game)) continue;
      const gameLeagues = gameEntry.game[1];
      if (!isRecord(gameLeagues) || !isRecord(gameLeagues.leagues)) continue;

      for (const leagueEntry of numberedEntries(gameLeagues.leagues)) {
        if (!isRecord(leagueEntry) || !isArray(leagueEntry.league)) continue;
        const meta = leagueEntry.league[0];
        const teamsWrapper = leagueEntry.league[1];
        if (!isRecord(meta)) continue;

        const ownTeamEntry = isRecord(teamsWrapper)
          ? numberedEntries(teamsWrapper.teams)[0]
          : undefined;
        let ownTeamKey: string | null = null;
        if (isRecord(ownTeamEntry) && isArray(ownTeamEntry.team)) {
          const teamInfo = ownTeamEntry.team[0];
          if (isArray(teamInfo)) {
            for (const item of teamInfo) {
              if (isRecord(item) && typeof item.team_key === "string") {
                ownTeamKey = item.team_key;
                break;
              }
            }
          }
        }
        if (!ownTeamKey) continue;

        const leagueKey = str(meta.league_key);
        const name = str(meta.name);
        const season = num(meta.season);
        if (!leagueKey || !name || season == null) continue;

        dtos.push({
          leagueKey,
          name,
          season,
          teamCount: num(meta.num_teams),
          ownTeamKey,
        });
      }
    }
  }
  return dtos;
}

/** Extracts one team's roster from GET /team/{teamKey}/roster. */
export function extractRosterPlayers(raw: unknown): YahooRosterPlayerDto[] {
  const dtos: YahooRosterPlayerDto[] = [];
  if (!isRecord(raw)) return dtos;
  const fantasyContent = raw.fantasy_content;
  if (!isRecord(fantasyContent) || !isArray(fantasyContent.team)) return dtos;
  const rosterWrapper = fantasyContent.team[1];
  if (!isRecord(rosterWrapper)) return dtos;
  const roster = isRecord(rosterWrapper.roster) ? rosterWrapper.roster : rosterWrapper;
  const playersWrapper = isRecord(roster["0"]) ? roster["0"].players : roster.players;

  for (const playerEntry of numberedEntries(playersWrapper)) {
    if (!isRecord(playerEntry) || !isArray(playerEntry.player)) continue;
    const [playerInfo, playerMeta] = playerEntry.player;
    if (!isArray(playerInfo)) continue;

    let playerKey: string | null = null;
    let name: string | null = null;
    let position: string | null = null;
    let nflTeam: string | null = null;
    for (const item of playerInfo) {
      if (!isRecord(item)) continue;
      if (typeof item.player_key === "string") playerKey = item.player_key;
      if (isRecord(item.name)) {
        name =
          str(item.name.full) ??
          [str(item.name.ascii_first), str(item.name.ascii_last)].filter(Boolean).join(" ");
      }
      if (typeof item.display_position === "string") position = item.display_position;
      if (typeof item.editorial_team_abbr === "string") nflTeam = item.editorial_team_abbr;
    }
    if (!playerKey || !name) continue;

    let slot: "STARTER" | "BENCH" | "IR" = "BENCH";
    const selectedPosition = isRecord(playerMeta) ? playerMeta.selected_position : undefined;
    if (isArray(selectedPosition)) {
      for (const sp of selectedPosition) {
        if (isRecord(sp) && typeof sp.position === "string") {
          const pos = sp.position.toUpperCase();
          slot = pos === "IR" ? "IR" : pos === "BN" ? "BENCH" : "STARTER";
          break;
        }
      }
    }

    dtos.push(yahooRosterPlayerDtoSchema.parse({
      providerPlayerId: playerKey,
      name,
      position,
      nflTeam,
      slot,
    }));
  }
  return dtos;
}

/** Extracts one team's draft picks from GET /team/{teamKey}/draftresults. */
export function extractDraftPicks(raw: unknown): YahooDraftPickDto[] {
  const dtos: YahooDraftPickDto[] = [];
  if (!isRecord(raw)) return dtos;
  const fantasyContent = raw.fantasy_content;
  if (!isRecord(fantasyContent) || !isArray(fantasyContent.team)) return dtos;
  const draftWrapper = fantasyContent.team[1];
  if (!isRecord(draftWrapper)) return dtos;
  const results = isRecord(draftWrapper.draft_results) ? draftWrapper.draft_results : undefined;

  for (const pickEntry of numberedEntries(results)) {
    if (!isRecord(pickEntry) || !isRecord(pickEntry.draft_result)) continue;
    const pick = pickEntry.draft_result;
    const round = num(pick.round);
    const pickNo = num(pick.pick);
    if (round == null || pickNo == null) continue;

    dtos.push(yahooDraftPickDtoSchema.parse({
      round,
      pickNo,
      providerPlayerId: str(pick.player_key),
    }));
  }
  return dtos;
}

export function normalizeYahooLeague(
  league: YahooLeagueDto,
  rosterPlayers: YahooRosterPlayerDto[],
  draftPicks: YahooDraftPickDto[],
): NormalizedLeagueBundle {
  const validatedLeague = yahooLeagueDtoSchema.parse(league);

  const players: NormalizedPlayer[] = rosterPlayers.map((p) => ({
    providerPlayerId: p.providerPlayerId,
    name: p.name,
    position: p.position,
    nflTeam: p.nflTeam,
  }));

  const normalizedDraftPicks: NormalizedDraftPick[] = draftPicks.map((p) => ({
    round: p.round,
    pickNo: p.pickNo,
    providerPlayerId: p.providerPlayerId,
    isKeeper: false,
    amount: null,
  }));

  return {
    league: {
      provider: "yahoo",
      providerLeagueId: validatedLeague.leagueKey,
      season: validatedLeague.season,
      name: validatedLeague.name,
      totalTeams: validatedLeague.teamCount,
      raw: league,
    },
    rosterEntries: rosterPlayers.map((p) => ({
      providerPlayerId: p.providerPlayerId,
      slot: p.slot,
    })),
    draftPicks: normalizedDraftPicks,
    players,
  };
}
