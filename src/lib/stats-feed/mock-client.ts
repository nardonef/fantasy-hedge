import type { GameStatus, StatsFeedClient } from "./types";

export type MockStatsFeedData = {
  gameStatuses?: Record<string, GameStatus>;
  /** Keyed by `${playerId}:${gameId}:${statCategory}`. */
  playerGameStats?: Record<string, number>;
  seasonComplete?: Record<number, boolean>;
  /** Keyed by `${playerId}:${season}:${statCategory}`. */
  playerSeasonStats?: Record<string, number>;
  /** Keyed by `${playerId}:${season}`. */
  playerGamesMissed?: Record<string, number>;
};

/** In-memory StatsFeedClient for seeding, dev, and tests — no network. */
export function createMockStatsFeedClient(data: MockStatsFeedData): StatsFeedClient {
  return {
    async getGameStatus(gameId) {
      return data.gameStatuses?.[gameId] ?? "SCHEDULED";
    },
    async getPlayerGameStat(playerId, gameId, statCategory) {
      return data.playerGameStats?.[`${playerId}:${gameId}:${statCategory}`] ?? null;
    },
    async isSeasonComplete(season) {
      return data.seasonComplete?.[season] ?? false;
    },
    async getPlayerSeasonStat(playerId, season, statCategory) {
      return data.playerSeasonStats?.[`${playerId}:${season}:${statCategory}`] ?? null;
    },
    async getPlayerGamesMissed(playerId, season) {
      return data.playerGamesMissed?.[`${playerId}:${season}`] ?? null;
    },
  };
}
