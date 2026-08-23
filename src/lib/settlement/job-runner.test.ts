import { beforeEach, describe, expect, it, vi } from "vitest";

if (!process.env.TEST_DATABASE_URL?.includes("test")) {
  throw new Error("TEST_DATABASE_URL must be set and contain 'test'");
}
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

const { db } = await import("@/db/client");
const { eq } = await import("drizzle-orm");
const { markets, players, settlementJobs } = await import("@/db/schema");
const { runMarketWithAudit } = await import("./job-runner");

const JOB_TYPE = "test-job";

async function seedMarket() {
  const [player] = await db
    .insert(players)
    .values({ name: "Job Runner Player", normalizedName: "job runner player", position: "WR", nflTeam: "SF" })
    .returning();
  const [market] = await db
    .insert(markets)
    .values({
      marketType: "GAME_PROP",
      playerId: player.id,
      nflSeason: 2026,
      statCategory: "receiving_yards",
      thresholdValue: 50,
      comparator: "OVER",
      pricingModel: "test",
      closesAt: new Date(),
    })
    .returning();
  return market.id;
}

describe("runMarketWithAudit", () => {
  beforeEach(async () => {
    await db.delete(settlementJobs);
    await db.delete(markets);
    await db.delete(players);
  });

  it("records a SUCCEEDED attempt and returns the settle function's outcome", async () => {
    const marketId = await seedMarket();
    const settleOne = vi.fn().mockResolvedValue({ outcome: "SETTLED" });

    const result = await runMarketWithAudit(JOB_TYPE, marketId, settleOne);

    expect(result).toEqual({ marketId, outcome: "SETTLED" });
    expect(settleOne).toHaveBeenCalledOnce();

    const [job] = await db.select().from(settlementJobs).where(eq(settlementJobs.marketId, marketId));
    expect(job).toMatchObject({ status: "SUCCEEDED", attemptCount: 1, jobType: JOB_TYPE });
  });

  it("records a FAILED attempt with the error message when settleOne throws", async () => {
    const marketId = await seedMarket();
    const settleOne = vi.fn().mockRejectedValue(new Error("stats feed unavailable"));

    const result = await runMarketWithAudit(JOB_TYPE, marketId, settleOne);

    expect(result).toEqual({ marketId, outcome: "FAILED" });

    const [job] = await db.select().from(settlementJobs).where(eq(settlementJobs.marketId, marketId));
    expect(job).toMatchObject({ status: "FAILED", error: "stats feed unavailable" });
  });

  it("skips a market still within backoff after a recent failure, without calling settleOne again", async () => {
    const marketId = await seedMarket();
    const failing = vi.fn().mockRejectedValue(new Error("boom"));
    await runMarketWithAudit(JOB_TYPE, marketId, failing);

    const settleOne = vi.fn().mockResolvedValue({ outcome: "SETTLED" });
    const result = await runMarketWithAudit(JOB_TYPE, marketId, settleOne);

    expect(result).toEqual({ marketId, outcome: "SKIPPED_BACKOFF" });
    expect(settleOne).not.toHaveBeenCalled();
  });

  it("retries once the backoff window has passed, and increments attemptCount", async () => {
    const marketId = await seedMarket();
    const failing = vi.fn().mockRejectedValue(new Error("boom"));
    await runMarketWithAudit(JOB_TYPE, marketId, failing);

    // Simulate the backoff window having elapsed by backdating the failed attempt.
    await db
      .update(settlementJobs)
      .set({ ranAt: new Date(Date.now() - 60 * 60_000) })
      .where(eq(settlementJobs.marketId, marketId));

    const settleOne = vi.fn().mockResolvedValue({ outcome: "SETTLED" });
    const result = await runMarketWithAudit(JOB_TYPE, marketId, settleOne);

    expect(result).toEqual({ marketId, outcome: "SETTLED" });
    expect(settleOne).toHaveBeenCalledOnce();

    const jobs = await db.select().from(settlementJobs).where(eq(settlementJobs.marketId, marketId));
    expect(jobs).toHaveLength(2);
    expect(jobs.find((j) => j.status === "SUCCEEDED")?.attemptCount).toBe(2);
  });

  it("does not let a different job type's failures trigger backoff for this job type", async () => {
    const marketId = await seedMarket();
    await runMarketWithAudit("other-job-type", marketId, vi.fn().mockRejectedValue(new Error("boom")));

    const settleOne = vi.fn().mockResolvedValue({ outcome: "SETTLED" });
    const result = await runMarketWithAudit(JOB_TYPE, marketId, settleOne);

    expect(result).toEqual({ marketId, outcome: "SETTLED" });
    expect(settleOne).toHaveBeenCalledOnce();
  });
});
