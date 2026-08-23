import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { settlementJobs } from "@/db/schema";

const BACKOFF_STEPS_MINUTES = [1, 5, 15, 60];

function backoffMinutesFor(consecutiveFailures: number): number {
  const index = Math.min(consecutiveFailures - 1, BACKOFF_STEPS_MINUTES.length - 1);
  return BACKOFF_STEPS_MINUTES[index];
}

async function recentAttempts(jobType: string, marketId: string) {
  return db
    .select()
    .from(settlementJobs)
    .where(and(eq(settlementJobs.jobType, jobType), eq(settlementJobs.marketId, marketId)))
    .orderBy(desc(settlementJobs.createdAt));
}

async function isInBackoff(jobType: string, marketId: string): Promise<boolean> {
  const attempts = await recentAttempts(jobType, marketId);

  let consecutiveFailures = 0;
  for (const attempt of attempts) {
    if (attempt.status !== "FAILED") break;
    consecutiveFailures++;
  }
  if (consecutiveFailures === 0) return false;

  const lastAttempt = attempts[0];
  if (!lastAttempt.ranAt) return false;

  const backoffMs = backoffMinutesFor(consecutiveFailures) * 60_000;
  return Date.now() - lastAttempt.ranAt.getTime() < backoffMs;
}

export type MarketRunOutcome = { marketId: string; outcome: string };

/**
 * Wraps one market's settlement attempt with audit logging (settlementJobs — one row per
 * attempt) and exponential backoff, so a market whose settlement keeps throwing (a transient
 * stats-feed error, say) doesn't get hammered on every cron tick, and doesn't block sibling
 * markets in the same run from being processed (each market gets its own try/catch here,
 * whereas an unhandled exception inside the caller's loop would abort the whole run).
 */
export async function runMarketWithAudit(
  jobType: string,
  marketId: string,
  settleOne: () => Promise<{ outcome: string }>,
): Promise<MarketRunOutcome> {
  if (await isInBackoff(jobType, marketId)) {
    return { marketId, outcome: "SKIPPED_BACKOFF" };
  }

  const previousAttempts = await recentAttempts(jobType, marketId);
  const attemptCount = previousAttempts.length + 1;

  const [job] = await db
    .insert(settlementJobs)
    .values({ marketId, jobType, status: "RUNNING", attemptCount, ranAt: new Date() })
    .returning();

  try {
    const result = await settleOne();
    await db
      .update(settlementJobs)
      .set({ status: "SUCCEEDED", updatedAt: new Date() })
      .where(eq(settlementJobs.id, job.id));
    return { marketId, outcome: result.outcome };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db
      .update(settlementJobs)
      .set({ status: "FAILED", error: message, updatedAt: new Date() })
      .where(eq(settlementJobs.id, job.id));
    return { marketId, outcome: "FAILED" };
  }
}
