import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { nflGames, playerExternalIds } from "@/db/schema";
import type { GameStatus, StatsFeedClient } from "../types";
import {
  computeGameStatus,
  countMissedGames,
  findGsisId,
  findScheduleRow,
  findSeasonStatRow,
  findWeeklyStatRow,
  readStatValue,
} from "./nflverse-data";
import { fetchCrosswalk, fetchSchedule, fetchSeasonStats, fetchWeeklyStats } from "./nflverse-fetch";

async function resolveGsisId(playerId: string): Promise<string | null> {
  const externalIds = await db
    .select()
    .from(playerExternalIds)
    .where(eq(playerExternalIds.playerId, playerId));

  const sleeperId = externalIds.find((e) => e.provider === "sleeper")?.providerPlayerId ?? null;
  const yahooPlayerKey = externalIds.find((e) => e.provider === "yahoo")?.providerPlayerId ?? null;
  if (!sleeperId && !yahooPlayerKey) return null;

  const crosswalk = await fetchCrosswalk();
  return findGsisId(crosswalk, { sleeperId, yahooPlayerKey });
}

/**
 * StatsFeedClient backed by nflverse (github.com/nflverse/nflverse-data) and the dynastyprocess
 * player-id crosswalk — both free, community-maintained, and updated once daily, not live. That
 * cadence is fine for settlement, which only needs a final result, not a live score.
 *
 * getPlayerGamesMissed is a best-effort proxy (see nflverse-data.ts) — treat its output as a
 * starting point for review, not an authoritative payout trigger, per the project's decision to
 * flag injury-designation timing as needing human-in-the-loop confirmation.
 */
export function createNflverseStatsFeedClient(): StatsFeedClient {
  return {
    async getGameStatus(gameId): Promise<GameStatus> {
      const [game] = await db.select().from(nflGames).where(eq(nflGames.id, gameId)).limit(1);
      if (!game) return "SCHEDULED";

      const schedule = await fetchSchedule(game.season);
      const row = findScheduleRow(schedule, {
        season: game.season,
        week: game.week,
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
      });
      return computeGameStatus(row);
    },

    async getPlayerGameStat(playerId, gameId, statCategory): Promise<number | null> {
      const [game] = await db.select().from(nflGames).where(eq(nflGames.id, gameId)).limit(1);
      if (!game) return null;

      const gsisId = await resolveGsisId(playerId);
      if (!gsisId) return null;

      const weeklyStats = await fetchWeeklyStats(game.season);
      const row = findWeeklyStatRow(weeklyStats, { gsisId, week: game.week, seasonType: "REG" });
      return row ? readStatValue(row, statCategory) : null;
    },

    async isSeasonComplete(season): Promise<boolean> {
      const schedule = await fetchSchedule(season);
      const regSeasonGames = schedule.filter((r) => r.game_type === "REG");
      if (regSeasonGames.length === 0) return false;
      return regSeasonGames.every((r) => r.home_score && r.away_score);
    },

    async getPlayerSeasonStat(playerId, season, statCategory): Promise<number | null> {
      const gsisId = await resolveGsisId(playerId);
      if (!gsisId) return null;

      const seasonStats = await fetchSeasonStats(season);
      const row = findSeasonStatRow(seasonStats, gsisId);
      return row ? readStatValue(row, statCategory) : null;
    },

    async getPlayerGamesMissed(playerId, season): Promise<number | null> {
      const gsisId = await resolveGsisId(playerId);
      if (!gsisId) return null;

      const [weeklyStats, schedule] = await Promise.all([fetchWeeklyStats(season), fetchSchedule(season)]);
      const playerWeeklyRows = weeklyStats.filter((r) => r.player_id === gsisId && r.season_type === "REG");
      if (playerWeeklyRows.length === 0) return null; // player never appears this season — can't tell their team

      const team = playerWeeklyRows[0].team;
      const regSeasonGames = schedule.filter((r) => r.game_type === "REG");
      return countMissedGames(regSeasonGames, playerWeeklyRows, team);
    },
  };
}
