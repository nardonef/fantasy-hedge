import { integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { markets } from "./markets";

export type ResolutionSource = "STATS_FEED" | "INACTIVE_LIST" | "MANUAL_OVERRIDE";

/**
 * The permanent record of how a market resolved and why — resolutionData captures the raw
 * stat/injury snapshot a payout was computed from, so a payout is auditable after the fact.
 */
export const settlements = pgTable(
  "settlements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    marketId: uuid("market_id")
      .notNull()
      .references(() => markets.id, { onDelete: "cascade" }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }).notNull().defaultNow(),
    /** contractId -> payout ratio (0..1) paid per share held. */
    payouts: jsonb("payouts").$type<Record<string, number>>().notNull(),
    resolutionSource: text("resolution_source").$type<ResolutionSource>().notNull(),
    resolutionData: jsonb("resolution_data").notNull(),
    resolvedBy: text("resolved_by"),
    notes: text("notes"),
  },
  (t) => [uniqueIndex("settlements_market_ux").on(t.marketId)],
);

export type SettlementJobStatus = "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED";

/** Audit/retry log for automated settlement oracle runs — one row per attempt, not per market. */
export const settlementJobs = pgTable("settlement_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  marketId: uuid("market_id")
    .notNull()
    .references(() => markets.id, { onDelete: "cascade" }),
  jobType: text("job_type").notNull(),
  status: text("status").$type<SettlementJobStatus>().notNull().default("PENDING"),
  attemptCount: integer("attempt_count").notNull().default(0),
  error: text("error"),
  ranAt: timestamp("ran_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
