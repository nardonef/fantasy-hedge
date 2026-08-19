import { pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

/** One platform account, linked 1:1 to a Clerk identity. */
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clerkId: text("clerk_id").notNull(),
    email: text("email").notNull(),
    name: text("name"),
    avatarUrl: text("avatar_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("users_clerk_id_ux").on(t.clerkId),
    uniqueIndex("users_email_ux").on(t.email),
  ],
);
