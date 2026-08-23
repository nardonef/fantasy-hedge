export type GameStatus = "SCHEDULED" | "IN_PROGRESS" | "FINAL";

/**
 * What settlement jobs depend on to resolve markets, independent of vendor. Neither Sleeper's
 * nor Yahoo's fantasy APIs are authoritative real-time stat feeds — a real sports-data vendor
 * (Phase 5) implements this interface; a mock backs it until then, and settlement logic never
 * needs to change when the vendor does.
 */
export interface StatsFeedClient {
  getGameStatus(gameId: string): Promise<GameStatus>;
  /** The player's final stat value for one game, or null if not yet available. */
  getPlayerGameStat(playerId: string, gameId: string, statCategory: string): Promise<number | null>;
  /** True once the season is over and cumulative stats are final. */
  isSeasonComplete(season: number): Promise<boolean>;
  /** The player's cumulative stat total for the season, or null if not yet available. */
  getPlayerSeasonStat(playerId: string, season: number, statCategory: string): Promise<number | null>;
  /** Games missed to injury so far this season, or null if not yet available. */
  getPlayerGamesMissed(playerId: string, season: number): Promise<number | null>;
}
