import { doublePrecision, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { contracts, markets } from "./markets";
import { users } from "./users";
import { ledgerEntries } from "./wallet";

export type PositionStatus = "OPEN" | "SETTLED" | "VOIDED";

/** One user's holding in one contract — quantity accumulates across multiple buys. */
export const positions = pgTable(
  "positions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    contractId: uuid("contract_id")
      .notNull()
      .references(() => contracts.id, { onDelete: "cascade" }),
    marketId: uuid("market_id")
      .notNull()
      .references(() => markets.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull(),
    avgEntryPrice: doublePrecision("avg_entry_price").notNull(),
    status: text("status").$type<PositionStatus>().notNull().default("OPEN"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("positions_user_contract_ux").on(t.userId, t.contractId)],
);

export type TradeDirection = "BUY" | "SELL";

/**
 * One executed trade. There's no separate orders table — pricing is house-quoted, not a
 * matching engine, so a trade executes immediately at the contract's quoted price.
 */
export const trades = pgTable("trades", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  contractId: uuid("contract_id")
    .notNull()
    .references(() => contracts.id, { onDelete: "cascade" }),
  direction: text("direction").$type<TradeDirection>().notNull(),
  quantity: integer("quantity").notNull(),
  priceAtExecution: doublePrecision("price_at_execution").notNull(),
  /** Minor units of virtual currency. */
  notionalAmount: integer("notional_amount").notNull(),
  ledgerEntryId: uuid("ledger_entry_id")
    .notNull()
    .references(() => ledgerEntries.id),
  executedAt: timestamp("executed_at", { withTimezone: true }).notNull().defaultNow(),
});
