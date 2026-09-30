import { count, eq, max } from "drizzle-orm";
import { db } from "@/db/client";
import { markets } from "@/db/schema";

/** Best-effort: the auth pages must render even if the database is unreachable. */
export async function getOpenMarketsSummary(): Promise<{
  week: number | null;
  openCount: number;
} | null> {
  try {
    const [row] = await db
      .select({ openCount: count(), week: max(markets.nflWeek) })
      .from(markets)
      .where(eq(markets.status, "OPEN"));
    return row ?? null;
  } catch {
    return null;
  }
}
