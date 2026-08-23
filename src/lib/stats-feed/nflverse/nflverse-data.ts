import { parse } from "csv-parse/sync";
import type { GameStatus } from "../types";

export type CsvRow = Record<string, string>;

export function parseCsv(text: string): CsvRow[] {
  return parse(text, { columns: true, skip_empty_lines: true }) as CsvRow[];
}

/** Yahoo player identifiers are stored as player_key ("423.p.12345") — the crosswalk wants the bare numeric id. */
export function extractYahooNumericId(playerKey: string): string | null {
  const match = playerKey.match(/\.p\.(\d+)$/);
  return match ? match[1] : null;
}

/** Finds a player's nflverse gsis_id in the dynastyprocess crosswalk from their Sleeper or Yahoo id. */
export function findGsisId(
  crosswalk: CsvRow[],
  ids: { sleeperId?: string | null; yahooPlayerKey?: string | null },
): string | null {
  const yahooId = ids.yahooPlayerKey ? extractYahooNumericId(ids.yahooPlayerKey) : null;

  for (const row of crosswalk) {
    if (!row.gsis_id || row.gsis_id === "NA") continue;
    if (ids.sleeperId && row.sleeper_id === ids.sleeperId) return row.gsis_id;
    if (yahooId && row.yahoo_id === yahooId) return row.gsis_id;
  }
  return null;
}

export type ScheduleRow = CsvRow;

export function findScheduleRow(
  schedule: ScheduleRow[],
  params: { season: number; week: number; homeTeam: string; awayTeam: string },
): ScheduleRow | undefined {
  return schedule.find(
    (r) =>
      Number(r.season) === params.season &&
      Number(r.week) === params.week &&
      r.home_team === params.homeTeam &&
      r.away_team === params.awayTeam,
  );
}

/** A game is FINAL once nflverse's daily pipeline has recorded both final scores — this data updates next-day, not live. */
export function computeGameStatus(scheduleRow: ScheduleRow | undefined): GameStatus {
  if (!scheduleRow) return "SCHEDULED";
  if (scheduleRow.home_score && scheduleRow.away_score) return "FINAL";
  if (scheduleRow.gameday && new Date(scheduleRow.gameday) < new Date()) return "IN_PROGRESS";
  return "SCHEDULED";
}

export function findWeeklyStatRow(
  weeklyStats: CsvRow[],
  params: { gsisId: string; week: number; seasonType?: string },
): CsvRow | undefined {
  return weeklyStats.find(
    (r) =>
      r.player_id === params.gsisId &&
      Number(r.week) === params.week &&
      (params.seasonType == null || r.season_type === params.seasonType),
  );
}

export function findSeasonStatRow(regSeasonStats: CsvRow[], gsisId: string): CsvRow | undefined {
  return regSeasonStats.find((r) => r.player_id === gsisId);
}

/** Parses a stat column, treating blank/missing as 0 — nflverse leaves inapplicable stat columns empty rather than "0". */
export function readStatValue(row: CsvRow, statCategory: string): number {
  const raw = row[statCategory];
  if (raw == null || raw === "") return 0;
  const value = Number(raw);
  return Number.isNaN(value) ? 0 : value;
}

/**
 * Counts games a player has no weekly stat row for, among their team's regular-season games —
 * a rough proxy for "games missed to injury," not a ground truth. It can't distinguish injury
 * from a healthy scratch, benching, or a bye week misattributed to the wrong team; treat it as
 * a starting point for manual settlement review, not an authoritative payout trigger.
 */
export function countMissedGames(
  teamScheduleRows: ScheduleRow[],
  playerWeeklyRows: CsvRow[],
  team: string,
): number {
  const playedWeeks = new Set(playerWeeklyRows.map((r) => Number(r.week)));
  let missed = 0;
  for (const row of teamScheduleRows) {
    if (row.home_team !== team && row.away_team !== team) continue;
    if (!row.home_score || !row.away_score) continue; // game hasn't happened yet
    if (!playedWeeks.has(Number(row.week))) missed++;
  }
  return missed;
}
