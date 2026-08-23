import { describe, expect, it } from "vitest";
import {
  computeGameStatus,
  findGsisId,
  findScheduleRow,
  findSeasonStatRow,
  findWeeklyStatRow,
  readStatValue,
} from "./nflverse-data";
import { fetchCrosswalk, fetchSchedule, fetchSeasonStats, fetchWeeklyStats } from "./nflverse-fetch";

/**
 * Contract tests against the real nflverse/dynastyprocess data sources — confirms the URL
 * patterns and column names this integration depends on haven't changed upstream. Run via
 * `pnpm test:live`, not part of the default suite or CI.
 */
describe("nflverse live data contract", () => {
  it("fetches the 2025 schedule and finds a known completed game", async () => {
    const schedule = await fetchSchedule(2025);
    expect(schedule.length).toBeGreaterThan(200);

    const row = findScheduleRow(schedule, { season: 2025, week: 1, homeTeam: "NYJ", awayTeam: "PIT" });
    expect(row).toBeDefined();
    expect(computeGameStatus(row)).toBe("FINAL");
  });

  it("fetches 2025 weekly player stats and reads a known stat line", async () => {
    const weeklyStats = await fetchWeeklyStats(2025);
    expect(weeklyStats.length).toBeGreaterThan(1000);

    // Aaron Rodgers, week 1 2025 — a completed game whose box score shouldn't change.
    const row = findWeeklyStatRow(weeklyStats, { gsisId: "00-0023459", week: 1, seasonType: "REG" });
    expect(row).toBeDefined();
    expect(readStatValue(row ?? {}, "passing_yards")).toBeGreaterThan(0);
  });

  it("fetches 2025 season-aggregate stats", async () => {
    const seasonStats = await fetchSeasonStats(2025);
    expect(seasonStats.length).toBeGreaterThan(500);

    const row = findSeasonStatRow(seasonStats, "00-0023459");
    expect(row).toBeDefined();
  });

  it("fetches the dynastyprocess crosswalk and resolves a known player's gsis_id", async () => {
    const crosswalk = await fetchCrosswalk();
    expect(crosswalk.length).toBeGreaterThan(1000);

    expect(findGsisId(crosswalk, { sleeperId: "96" })).toBeTruthy(); // Aaron Rodgers' Sleeper id
  });
});
