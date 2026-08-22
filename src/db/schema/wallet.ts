import { integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { markets } from "./markets";
import { users } from "./users";

export type WalletCurrency = "VIRTUAL";

/** balance is a derived, reconciled cache — ledgerEntries is the source of truth for money. */
export const wallets = pgTable(
  "wallets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Minor units of virtual currency. */
    balance: integer("balance").notNull().default(0),
    currency: text("currency").$type<WalletCurrency>().notNull().default("VIRTUAL"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("wallets_user_ux").on(t.userId)],
);

export type LedgerEntryType =
  | "SIGNUP_GRANT"
  | "CONTRACT_BUY"
  | "CONTRACT_SELL"
  | "SETTLEMENT_PAYOUT"
  | "SETTLEMENT_LOSS"
  | "ADJUSTMENT"
  | "REFUND_VOID";

/**
 * The source of truth for money. Every wallet mutation is one row here, written inside the
 * same transaction that updates wallets.balance — never a bare UPDATE ... balance. idempotencyKey
 * makes every write safe to retry (a webhook redelivery, a job re-run) without double-applying.
 */
export const ledgerEntries = pgTable(
  "ledger_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    walletId: uuid("wallet_id")
      .notNull()
      .references(() => wallets.id, { onDelete: "cascade" }),
    type: text("type").$type<LedgerEntryType>().notNull(),
    /** Signed, minor units — positive credits the wallet, negative debits it. */
    amount: integer("amount").notNull(),
    balanceAfter: integer("balance_after").notNull(),
    /**
     * Soft references (no FK) — positions.ts is defined after this file and a positions ->
     * ledgerEntries FK (via trades.ledgerEntryId) already exists in the other direction, so
     * adding one here too would create a cycle. relatedMarketId does have a real FK since
     * markets.ts has no dependency on this file.
     */
    relatedPositionId: uuid("related_position_id"),
    relatedMarketId: uuid("related_market_id").references(() => markets.id, {
      onDelete: "set null",
    }),
    idempotencyKey: text("idempotency_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("ledger_entries_idempotency_key_ux").on(t.idempotencyKey)],
);
