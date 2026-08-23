import { doublePrecision, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { nflGames } from "./games";
import { players } from "./players";

export type MarketType = "GAME_PROP" | "SEASON_PRODUCTION" | "INJURY_PROTECTION";
export type MarketStatus = "OPEN" | "LOCKED" | "SETTLING" | "SETTLED" | "VOID";
export type Comparator = "OVER" | "UNDER" | "AT_LEAST" | "EXACTLY";

/**
 * A fixed-odds, house-priced contract offering, global across all users (one market per
 * player/game/season — hedge value comes from real NFL outcomes, not any one league's scoring).
 * All three market types share this shape; they differ in pricingModel/pricingParams and in
 * which pure pricing/settlement function (src/lib/pricing, src/lib/settlement) reads them.
 */
export const markets = pgTable("markets", {
  id: uuid("id").primaryKey().defaultRandom(),
  marketType: text("market_type").$type<MarketType>().notNull(),
  playerId: uuid("player_id")
    .notNull()
    .references(() => players.id, { onDelete: "cascade" }),
  nflSeason: integer("nfl_season").notNull(),
  /** Set for GAME_PROP; null for season-long market types. */
  nflWeek: integer("nfl_week"),
  /** Set for GAME_PROP; null for season-long market types. */
  gameId: uuid("game_id").references(() => nflGames.id, { onDelete: "set null" }),
  statCategory: text("stat_category").notNull(),
  thresholdValue: doublePrecision("threshold_value").notNull(),
  comparator: text("comparator").$type<Comparator>().notNull(),
  status: text("status").$type<MarketStatus>().notNull().default("OPEN"),
  pricingModel: text("pricing_model").notNull(),
  pricingParams: jsonb("pricing_params").$type<Record<string, unknown>>(),
  openAt: timestamp("open_at", { withTimezone: true }).notNull().defaultNow(),
  closesAt: timestamp("closes_at", { withTimezone: true }).notNull(),
  resolvesAt: timestamp("resolves_at", { withTimezone: true }),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * One outcome partition of a market. A binary game prop has 2 (OVER/UNDER); a tiered injury
 * or season-threshold market has N. currentPrice is an implied probability in (0,1) — the
 * cost to buy one share that pays out 1 x payoutRatio at settlement.
 */
export const contracts = pgTable(
  "contracts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    marketId: uuid("market_id")
      .notNull()
      .references(() => markets.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    currentPrice: doublePrecision("current_price").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("contracts_market_label_ux").on(t.marketId, t.label)],
);

export type Market = typeof markets.$inferSelect;
export type Contract = typeof contracts.$inferSelect;
