import { settleGameProp } from "./game-prop-settlement";

/**
 * Season-production settlement is the same over/under/push comparison as a single-game prop —
 * whether the "actual value" is one game's box score or a full season's cumulative total, the
 * threshold math doesn't change. Re-exported under its own name for call-site clarity rather
 * than duplicating the function.
 */
export const settleSeasonProduction = settleGameProp;
