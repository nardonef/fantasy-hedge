import { pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import type { Provider } from "./providers";

/** Global player registry, reconciled across providers via playerExternalIds. */
export const players = pgTable("players", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  /** Lowercased, punctuation-stripped name — the reconciliation key across providers. */
  normalizedName: text("normalized_name").notNull(),
  position: text("position"),
  nflTeam: text("nfl_team"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Joins a provider's own player id space (Sleeper numeric ids, Yahoo player names) to one
 * global players row. This is the reconciliation point for a user connecting both providers.
 */
export const playerExternalIds = pgTable(
  "player_external_ids",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    provider: text("provider").$type<Provider>().notNull(),
    providerPlayerId: text("provider_player_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("player_external_ids_provider_player_ux").on(t.provider, t.providerPlayerId),
  ],
);
