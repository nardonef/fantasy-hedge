import { z } from "zod";

/**
 * Zod schemas for the Sleeper API payloads we consume. Deliberately loose (`.loose()`) —
 * Sleeper adds fields freely; we validate only what we read and fail loudly if those are
 * missing or misshaped.
 */

export const sleeperUserSchema = z
  .object({
    user_id: z.string(),
    username: z.string().nullish(),
  })
  .loose();
export type SleeperUser = z.infer<typeof sleeperUserSchema>;

export const sleeperLeagueSchema = z
  .object({
    league_id: z.string(),
    name: z.string(),
    season: z.string(),
    total_rosters: z.number(),
  })
  .loose();
export type SleeperLeague = z.infer<typeof sleeperLeagueSchema>;
export const sleeperUserLeaguesSchema = z.array(sleeperLeagueSchema);

export const sleeperRosterSchema = z
  .object({
    roster_id: z.number(),
    owner_id: z.string().nullish(),
    players: z.array(z.string()).nullish(),
    starters: z.array(z.string()).nullish(),
    reserve: z.array(z.string()).nullish(),
    taxi: z.array(z.string()).nullish(),
  })
  .loose();
export type SleeperRoster = z.infer<typeof sleeperRosterSchema>;
export const sleeperRostersSchema = z.array(sleeperRosterSchema);

export const sleeperDraftSchema = z
  .object({
    draft_id: z.string(),
    status: z.string().nullish(),
  })
  .loose();
export type SleeperDraft = z.infer<typeof sleeperDraftSchema>;
export const sleeperDraftsSchema = z.array(sleeperDraftSchema);

export const sleeperDraftPickSchema = z
  .object({
    round: z.number(),
    pick_no: z.number(),
    roster_id: z.number().nullish(),
    player_id: z.string().nullish(),
    is_keeper: z.boolean().nullish(),
    metadata: z.object({ amount: z.string().nullish() }).loose().nullish(),
  })
  .loose();
export type SleeperDraftPick = z.infer<typeof sleeperDraftPickSchema>;
export const sleeperDraftPicksSchema = z.array(sleeperDraftPickSchema);

export const sleeperPlayerSchema = z
  .object({
    player_id: z.string().optional(),
    first_name: z.string().nullish(),
    last_name: z.string().nullish(),
    full_name: z.string().nullish(),
    position: z.string().nullish(),
    team: z.string().nullish(),
  })
  .loose();
export type SleeperPlayer = z.infer<typeof sleeperPlayerSchema>;
export const sleeperPlayersSchema = z.record(z.string(), sleeperPlayerSchema);
