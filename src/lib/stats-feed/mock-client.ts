import type { GameStatus, StatsFeedClient } from "./types";

export type MockStatsFeedData = {
  gameStatuses: Record<string, GameStatus>;
  /** Keyed by `${playerId}:${gameId}:${statCategory}`. */
  playerGameStats: Record<string, number>;
};

/** In-memory StatsFeedClient for seeding, dev, and tests — no network. */
export function createMockStatsFeedClient(data: MockStatsFeedData): StatsFeedClient {
  return {
    async getGameStatus(gameId) {
      return data.gameStatuses[gameId] ?? "SCHEDULED";
    },
    async getPlayerGameStat(playerId, gameId, statCategory) {
      return data.playerGameStats[`${playerId}:${gameId}:${statCategory}`] ?? null;
    },
  };
}
