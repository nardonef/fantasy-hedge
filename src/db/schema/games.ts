import { doublePrecision, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { players } from "./players";

export type GameStatus = "SCHEDULED" | "IN_PROGRESS" | "FINAL";

/** Lightweight NFL schedule/game-state — kickoff time and status, not full play-by-play. */
export const nflGames = pgTable(
  "nfl_games",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    season: integer("season").notNull(),
    week: integer("week").notNull(),
    homeTeam: text("home_team").notNull(),
    awayTeam: text("away_team").notNull(),
    kickoffAt: timestamp("kickoff_at", { withTimezone: true }).notNull(),
    status: text("status").$type<GameStatus>().notNull().default("SCHEDULED"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("nfl_games_season_week_teams_ux").on(t.season, t.week, t.homeTeam, t.awayTeam),
  ],
);

/**
 * A per-player stat snapshot — one game's box-score line (week set, gameId set) or a
 * season-to-date total (week null, gameId null). Feeds both pricing and settlement.
 */
export const statLines = pgTable(
  "stat_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    gameId: uuid("game_id").references(() => nflGames.id, { onDelete: "cascade" }),
    season: integer("season").notNull(),
    week: integer("week"),
    statCategory: text("stat_category").notNull(),
    statValue: doublePrecision("stat_value").notNull(),
    /** "mock" until a real vendor is wired in (Phase 5). */
    source: text("source").notNull(),
    raw: jsonb("raw"),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("stat_lines_player_season_category_ix").on(t.playerId, t.season, t.statCategory)],
);
