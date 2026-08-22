import { jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";

export type Provider = "sleeper" | "yahoo";

/**
 * One connected fantasy-platform account per user. Sleeper is a public API — no tokens,
 * providerUserId is the Sleeper user id looked up by username. Yahoo is OAuth2 — accessToken/
 * refreshToken/tokenExpiry are populated and auto-refreshed by src/lib/yahoo-oauth.ts.
 */
export const providerAccounts = pgTable(
  "provider_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").$type<Provider>().notNull(),
    providerUserId: text("provider_user_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    tokenExpiry: timestamp("token_expiry", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("provider_accounts_provider_user_ux").on(t.provider, t.providerUserId)],
);
