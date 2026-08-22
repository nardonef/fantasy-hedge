import { describe, expect, it } from "vitest";
import {
  extractDraftPicks,
  extractLeaguesAndOwnTeams,
  extractRosterPlayers,
  normalizeYahooLeague,
} from "./normalize";

// Fixtures mirror Yahoo's XML-derived JSON shape: ordered collections come back as
// {"0": ..., "1": ..., "count": n} objects rather than arrays.

const leaguesAndTeamsResponse = {
  fantasy_content: {
    users: {
      count: 1,
      "0": {
        user: [
          { guid: "yahoo-guid-1" },
          {
            games: {
              count: 1,
              "0": {
                game: [
                  { game_key: "423", code: "nfl", season: "2026" },
                  {
                    leagues: {
                      count: 1,
                      "0": {
                        league: [
                          {
                            league_key: "423.l.12345",
                            name: "The League",
                            season: "2026",
                            num_teams: "10",
                          },
                          {
                            teams: {
                              count: 1,
                              "0": {
                                team: [
                                  [{ team_key: "423.l.12345.t.3" }, { name: "My Team" }],
                                ],
                              },
                            },
                          },
                        ],
                      },
                    },
                  },
                ],
              },
            },
          },
        ],
      },
    },
  },
};

const rosterResponse = {
  fantasy_content: {
    team: [
      [{ team_key: "423.l.12345.t.3" }],
      {
        roster: {
          "0": {
            players: {
              count: 2,
              "0": {
                player: [
                  [
                    { player_key: "423.p.100" },
                    { name: { full: "Star Player", ascii_first: "Star", ascii_last: "Player" } },
                    { display_position: "WR" },
                    { editorial_team_abbr: "SF" },
                  ],
                  {
                    selected_position: [{ coverage_type: "week" }, { position: "WR" }],
                  },
                ],
              },
              "1": {
                player: [
                  [
                    { player_key: "423.p.200" },
                    { name: { full: "Bench Guy" } },
                    { display_position: "RB" },
                    { editorial_team_abbr: "KC" },
                  ],
                  {
                    selected_position: [{ coverage_type: "week" }, { position: "BN" }],
                  },
                ],
              },
            },
          },
        },
      },
    ],
  },
};

const draftResultsResponse = {
  fantasy_content: {
    team: [
      [{ team_key: "423.l.12345.t.3" }],
      {
        draft_results: {
          count: 1,
          "0": {
            draft_result: {
              pick: "3",
              round: "1",
              team_key: "423.l.12345.t.3",
              player_key: "423.p.100",
            },
          },
        },
      },
    ],
  },
};

describe("extractLeaguesAndOwnTeams", () => {
  it("extracts league metadata and the user's own team key", () => {
    const leagues = extractLeaguesAndOwnTeams(leaguesAndTeamsResponse);

    expect(leagues).toHaveLength(1);
    expect(leagues[0]).toMatchObject({
      leagueKey: "423.l.12345",
      name: "The League",
      season: 2026,
      teamCount: 10,
      ownTeamKey: "423.l.12345.t.3",
    });
  });

  it("returns an empty array for an unexpected shape rather than throwing", () => {
    expect(extractLeaguesAndOwnTeams({ unexpected: true })).toEqual([]);
    expect(extractLeaguesAndOwnTeams(null)).toEqual([]);
  });
});

describe("extractRosterPlayers", () => {
  it("extracts players with name, position, team, and slot", () => {
    const players = extractRosterPlayers(rosterResponse);

    expect(players).toHaveLength(2);
    expect(players[0]).toMatchObject({
      providerPlayerId: "423.p.100",
      name: "Star Player",
      position: "WR",
      nflTeam: "SF",
      slot: "STARTER",
    });
    expect(players[1]).toMatchObject({
      providerPlayerId: "423.p.200",
      slot: "BENCH",
    });
  });
});

describe("extractDraftPicks", () => {
  it("extracts round, pick number, and player key", () => {
    const picks = extractDraftPicks(draftResultsResponse);

    expect(picks).toHaveLength(1);
    expect(picks[0]).toMatchObject({ round: 1, pickNo: 3, providerPlayerId: "423.p.100" });
  });
});

describe("normalizeYahooLeague", () => {
  it("assembles a NormalizedLeagueBundle from the three extracted pieces", () => {
    const leagues = extractLeaguesAndOwnTeams(leaguesAndTeamsResponse);
    const players = extractRosterPlayers(rosterResponse);
    const picks = extractDraftPicks(draftResultsResponse);

    const bundle = normalizeYahooLeague(leagues[0], players, picks);

    expect(bundle.league).toMatchObject({
      provider: "yahoo",
      providerLeagueId: "423.l.12345",
      season: 2026,
      name: "The League",
      totalTeams: 10,
    });
    expect(bundle.rosterEntries).toHaveLength(2);
    expect(bundle.draftPicks).toEqual([
      { round: 1, pickNo: 3, providerPlayerId: "423.p.100", isKeeper: false, amount: null },
    ]);
    expect(bundle.players.map((p) => p.providerPlayerId)).toEqual(["423.p.100", "423.p.200"]);
  });
});
