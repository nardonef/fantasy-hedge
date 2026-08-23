import type { PgTransaction } from "drizzle-orm/pg-core";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js/session";
import type * as schema from "./schema";

/**
 * Either the top-level db handle or a transaction — both expose the same query builder API.
 * Functions that write money or other invariant-sensitive rows take this instead of importing
 * `db` directly, so a caller composing several writes into one atomic unit can pass its own
 * transaction through instead of each function opening its own.
 */
export type Executor =
  | PostgresJsDatabase<typeof schema>
  | PgTransaction<PostgresJsQueryResultHKT, typeof schema>;
