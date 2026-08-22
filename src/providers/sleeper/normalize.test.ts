import { describe, expect, it } from "vitest";
import { normalizeSleeperLeague, type SleeperLeaguePayloads } from "./normalize";

const OWN_USER_ID = "user-1";

function payloads(overrides: Partial<SleeperLeaguePayloads> = {}): SleeperLeaguePayloads {
  return {
    league: {
      league_id: "league-1",
      name: "The League",
      season: "2026",
      total_rosters: 10,
    },
    rosters: [
      {
        roster_id: 1,
        owner_id: OWN_USER_ID,
        players: ["100", "200", "300"],
        starters: ["100"],
        reserve: ["300"],
        taxi: [],
      },
      {
        roster_id: 2,
        owner_id: "user-2",
        players: ["400"],
        starters: ["400"],
      },
    ],
    drafts: [{ draft_id: "draft-1", status: "complete" }],
    draftPicksByDraft: {
      "draft-1": [
        { round: 1, pick_no: 1, roster_id: 1, player_id: "100", is_keeper: false },
        { round: 1, pick_no: 2, roster_id: 2, player_id: "400", is_keeper: false },
      ],
    },
    players: {
      "100": { full_name: "Star Player", position: "WR", team: "SF" },
      "200": { first_name: "Bench", last_name: "Guy", position: "RB", team: "KC" },
      "300": { full_name: "Hurt Player", position: "TE", team: "DAL" },
    },
    ...overrides,
  };
}

describe("normalizeSleeperLeague", () => {
  it("normalizes only the connected user's own roster", () => {
    const result = normalizeSleeperLeague(payloads(), OWN_USER_ID);

    expect(result.league).toMatchObject({
      provider: "sleeper",
      providerLeagueId: "league-1",
      season: 2026,
      name: "The League",
      totalTeams: 10,
    });
    expect(result.rosterEntries).toHaveLength(3);
    expect(result.rosterEntries.map((e) => e.providerPlayerId)).not.toContain("400");
  });

  it("classifies roster slots from starters/reserve/taxi", () => {
    const result = normalizeSleeperLeague(payloads(), OWN_USER_ID);
    const bySlot = Object.fromEntries(result.rosterEntries.map((e) => [e.providerPlayerId, e.slot]));

    expect(bySlot["100"]).toBe("STARTER");
    expect(bySlot["200"]).toBe("BENCH");
    expect(bySlot["300"]).toBe("IR");
  });

  it("only includes draft picks for the connected user's own roster_id", () => {
    const result = normalizeSleeperLeague(payloads(), OWN_USER_ID);

    expect(result.draftPicks).toHaveLength(1);
    expect(result.draftPicks[0]).toMatchObject({ pickNo: 1, providerPlayerId: "100" });
  });

  it("resolves player names, falling back to first+last when full_name is missing", () => {
    const result = normalizeSleeperLeague(payloads(), OWN_USER_ID);
    const byId = Object.fromEntries(result.players.map((p) => [p.providerPlayerId, p]));

    expect(byId["100"].name).toBe("Star Player");
    expect(byId["200"].name).toBe("Bench Guy");
  });

  it("falls back to the provider player id when no name is found in the player dump", () => {
    const result = normalizeSleeperLeague(payloads({ players: {} }), OWN_USER_ID);
    const byId = Object.fromEntries(result.players.map((p) => [p.providerPlayerId, p]));

    expect(byId["100"].name).toBe("100");
  });

  it("throws loudly when the connected user owns no roster in the league", () => {
    expect(() => normalizeSleeperLeague(payloads(), "someone-else")).toThrow(
      /No roster owned by Sleeper user/,
    );
  });
});
