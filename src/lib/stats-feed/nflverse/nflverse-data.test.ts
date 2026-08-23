import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  computeGameStatus,
  countMissedGames,
  extractYahooNumericId,
  findGsisId,
  findScheduleRow,
  findSeasonStatRow,
  findWeeklyStatRow,
  parseCsv,
  readStatValue,
} from "./nflverse-data";

const FIXTURES_DIR = join(process.cwd(), "fixtures", "nflverse");
const crosswalk = parseCsv(readFileSync(join(FIXTURES_DIR, "crosswalk-sample.csv"), "utf8"));
const schedule = parseCsv(readFileSync(join(FIXTURES_DIR, "schedule-sample.csv"), "utf8"));
const weeklyStats = parseCsv(readFileSync(join(FIXTURES_DIR, "weekly-stats-sample.csv"), "utf8"));
const seasonStats = parseCsv(readFileSync(join(FIXTURES_DIR, "season-stats-sample.csv"), "utf8"));

describe("parseCsv", () => {
  it("handles quoted fields containing commas", () => {
    expect(schedule[0].stadium).toBe("MetLife Stadium, East Rutherford");
  });

  it("parses the expected number of data rows", () => {
    expect(schedule).toHaveLength(3);
    expect(crosswalk).toHaveLength(3);
  });
});

describe("extractYahooNumericId", () => {
  it("extracts the numeric id from a Yahoo player_key", () => {
    expect(extractYahooNumericId("423.p.29279")).toBe("29279");
  });

  it("returns null for a malformed key", () => {
    expect(extractYahooNumericId("not-a-player-key")).toBeNull();
  });
});

describe("findGsisId", () => {
  it("finds a player by sleeper id", () => {
    expect(findGsisId(crosswalk, { sleeperId: "4046" })).toBe("00-0023459");
  });

  it("finds a player by yahoo player_key, extracting the numeric id first", () => {
    expect(findGsisId(crosswalk, { yahooPlayerKey: "423.p.29279" })).toBe("00-0023459");
  });

  it("returns null when neither id matches", () => {
    expect(findGsisId(crosswalk, { sleeperId: "nonexistent" })).toBeNull();
  });

  it("returns null when no ids are given", () => {
    expect(findGsisId(crosswalk, {})).toBeNull();
  });
});

describe("findScheduleRow / computeGameStatus", () => {
  it("finds the row for a season/week/matchup", () => {
    const row = findScheduleRow(schedule, { season: 2025, week: 1, homeTeam: "NYJ", awayTeam: "PIT" });
    expect(row?.game_id).toBe("2025_01_PIT_NYJ");
  });

  it("reports FINAL once both scores are recorded", () => {
    const row = findScheduleRow(schedule, { season: 2025, week: 1, homeTeam: "NYJ", awayTeam: "PIT" });
    expect(computeGameStatus(row)).toBe("FINAL");
  });

  it("reports SCHEDULED for a future game with no score", () => {
    const row = findScheduleRow(schedule, { season: 2025, week: 3, homeTeam: "NE", awayTeam: "PIT" });
    expect(computeGameStatus(row)).toBe("SCHEDULED");
  });

  it("reports SCHEDULED when no matching row is found", () => {
    expect(computeGameStatus(undefined)).toBe("SCHEDULED");
  });

  it("reports IN_PROGRESS for a past game with no score yet", () => {
    expect(computeGameStatus({ gameday: "2020-01-01", home_score: "", away_score: "" })).toBe("IN_PROGRESS");
  });
});

describe("findWeeklyStatRow / findSeasonStatRow / readStatValue", () => {
  it("finds a player's stat row for a specific week", () => {
    const row = findWeeklyStatRow(weeklyStats, { gsisId: "00-0023459", week: 1, seasonType: "REG" });
    expect(readStatValue(row ?? {}, "rushing_yards")).toBe(3);
  });

  it("returns undefined for a week the player has no row for", () => {
    const row = findWeeklyStatRow(weeklyStats, { gsisId: "00-0023459", week: 2, seasonType: "REG" });
    expect(row).toBeUndefined();
  });

  it("finds a player's season-aggregate row", () => {
    const row = findSeasonStatRow(seasonStats, "00-0023459");
    expect(readStatValue(row ?? {}, "passing_yards")).toBe(3900);
  });

  it("treats a blank stat column as 0, not NaN", () => {
    const row = findSeasonStatRow(seasonStats, "00-0041562");
    expect(readStatValue(row ?? {}, "receiving_yards")).toBe(0);
  });
});

describe("countMissedGames", () => {
  it("counts a played-but-unscored game as not-yet-missable and a scored game with no stat row as missed", () => {
    const playerWeeklyRows = weeklyStats.filter((r) => r.player_id === "00-0023459");
    // Rodgers/PIT has rows for week 1 and 3; the fixture schedule has PIT playing weeks 1-3,
    // with week 2 finalized and week 3 not yet played.
    const missed = countMissedGames(schedule, playerWeeklyRows, "PIT");
    expect(missed).toBe(1); // week 2 only — week 3 hasn't been played yet so it doesn't count
  });

  it("returns 0 when the player has a stat row for every played game", () => {
    const playedEveryScoredGame = [
      { player_id: "x", team: "PIT", week: "1" },
      { player_id: "x", team: "PIT", week: "2" },
    ];
    expect(countMissedGames(schedule, playedEveryScoredGame, "PIT")).toBe(0);
  });
});
