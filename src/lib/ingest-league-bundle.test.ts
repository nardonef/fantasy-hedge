import { beforeEach, describe, expect, it } from "vitest";
import type { NormalizedLeagueBundle } from "@/providers/types";

if (!process.env.TEST_DATABASE_URL?.includes("test")) {
  throw new Error("TEST_DATABASE_URL must be set and contain 'test'");
}
// db/client.ts reads DATABASE_URL at import time — point it at the test database before the
// first (dynamic) import of anything that transitively imports it.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

const { db } = await import("@/db/client");
const { draftPicks, leagues, playerExternalIds, players, providerAccounts, rosterEntries, users } =
  await import("@/db/schema");
const { ingestLeagueBundle } = await import("./ingest-league-bundle");

function bundle(overrides: Partial<NormalizedLeagueBundle> = {}): NormalizedLeagueBundle {
  return {
    league: {
      provider: "sleeper",
      providerLeagueId: "league-1",
      season: 2026,
      name: "The League",
      totalTeams: 10,
      raw: { league_id: "league-1" },
    },
    rosterEntries: [
      { providerPlayerId: "100", slot: "STARTER" },
      { providerPlayerId: "200", slot: "BENCH" },
    ],
    draftPicks: [{ round: 1, pickNo: 1, providerPlayerId: "100", isKeeper: false, amount: null }],
    players: [
      { providerPlayerId: "100", name: "Star Player", position: "WR", nflTeam: "SF" },
      { providerPlayerId: "200", name: "Bench Guy", position: "RB", nflTeam: "KC" },
    ],
    ...overrides,
  };
}

async function seedUserAndAccount() {
  const [user] = await db
    .insert(users)
    .values({ clerkId: "clerk-1", email: "a@example.com" })
    .returning();
  const [account] = await db
    .insert(providerAccounts)
    .values({ userId: user.id, provider: "sleeper", providerUserId: "sleeper-user-1" })
    .returning();
  return account.id;
}

describe("ingestLeagueBundle", () => {
  beforeEach(async () => {
    await db.delete(draftPicks);
    await db.delete(rosterEntries);
    await db.delete(leagues);
    await db.delete(playerExternalIds);
    await db.delete(players);
    await db.delete(providerAccounts);
    await db.delete(users);
  });

  it("persists the league, roster entries, players, and draft picks", async () => {
    const providerAccountId = await seedUserAndAccount();
    await ingestLeagueBundle(providerAccountId, bundle());

    const allLeagues = await db.select().from(leagues);
    expect(allLeagues).toHaveLength(1);
    expect(allLeagues[0]).toMatchObject({ providerLeagueId: "league-1", season: 2026 });

    expect(await db.select().from(rosterEntries)).toHaveLength(2);
    expect(await db.select().from(players)).toHaveLength(2);

    const allDraftPicks = await db.select().from(draftPicks);
    expect(allDraftPicks).toHaveLength(1);
    expect(allDraftPicks[0].playerId).not.toBeNull();
  });

  it("is idempotent — re-ingesting the same bundle does not duplicate rows", async () => {
    const providerAccountId = await seedUserAndAccount();
    await ingestLeagueBundle(providerAccountId, bundle());
    await ingestLeagueBundle(providerAccountId, bundle());

    expect(await db.select().from(leagues)).toHaveLength(1);
    expect(await db.select().from(rosterEntries)).toHaveLength(2);
    expect(await db.select().from(players)).toHaveLength(2);
    expect(await db.select().from(draftPicks)).toHaveLength(1);
  });

  it("reconciles a second provider's player to the same players row by normalized name", async () => {
    const providerAccountId = await seedUserAndAccount();
    await ingestLeagueBundle(providerAccountId, bundle());

    await ingestLeagueBundle(
      providerAccountId,
      bundle({
        league: {
          provider: "yahoo",
          providerLeagueId: "yahoo-league-1",
          season: 2026,
          name: "Yahoo League",
          totalTeams: 12,
          raw: {},
        },
        rosterEntries: [{ providerPlayerId: "yahoo.p.999", slot: "STARTER" }],
        draftPicks: [],
        players: [
          { providerPlayerId: "yahoo.p.999", name: "Star Player", position: "WR", nflTeam: "SF" },
        ],
      }),
    );

    expect(await db.select().from(players)).toHaveLength(2);
    const externalIds = await db.select().from(playerExternalIds);
    expect(externalIds).toHaveLength(3);
    const starPlayerLinks = externalIds.filter((e) =>
      ["100", "yahoo.p.999"].includes(e.providerPlayerId),
    );
    expect(new Set(starPlayerLinks.map((e) => e.playerId)).size).toBe(1);
  });
});
