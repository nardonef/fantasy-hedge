import { boolean, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import type { Provider } from "./providers";
import { providerAccounts } from "./providers";
import { players } from "./players";

/** One connected league-season for one provider account's own team — not full league history. */
export const leagues = pgTable(
  "leagues",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    providerAccountId: uuid("provider_account_id")
      .notNull()
      .references(() => providerAccounts.id, { onDelete: "cascade" }),
    provider: text("provider").$type<Provider>().notNull(),
    providerLeagueId: text("provider_league_id").notNull(),
    season: integer("season").notNull(),
    name: text("name").notNull(),
    totalTeams: integer("total_teams"),
    /** Raw provider league payload, kept for reprocessing without re-fetching. */
    raw: jsonb("raw"),
    syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("leagues_provider_league_ux").on(t.provider, t.providerLeagueId, t.season),
  ],
);

/** The connected user's current roster for a league — not the full league's rosters. */
export const rosterEntries = pgTable(
  "roster_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leagueId: uuid("league_id")
      .notNull()
      .references(() => leagues.id, { onDelete: "cascade" }),
    playerId: uuid("player_id").references(() => players.id, { onDelete: "set null" }),
    providerPlayerId: text("provider_player_id").notNull(),
    /** STARTER | BENCH | IR | TAXI */
    slot: text("slot").notNull(),
    syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("roster_entries_league_player_ux").on(t.leagueId, t.providerPlayerId)],
);

/** The connected user's own draft picks for a league — used for season-production baselines. */
export const draftPicks = pgTable(
  "draft_picks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leagueId: uuid("league_id")
      .notNull()
      .references(() => leagues.id, { onDelete: "cascade" }),
    playerId: uuid("player_id").references(() => players.id, { onDelete: "set null" }),
    providerPlayerId: text("provider_player_id"),
    round: integer("round").notNull(),
    pickNo: integer("pick_no").notNull(),
    isKeeper: boolean("is_keeper").notNull().default(false),
    amount: integer("amount"),
  },
  (t) => [uniqueIndex("draft_picks_league_pick_ux").on(t.leagueId, t.pickNo)],
);
