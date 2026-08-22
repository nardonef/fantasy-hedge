import { z } from "zod";

/**
 * Yahoo's raw JSON is XML converted mechanically (arrays become {"0":...,"1":...,"count":n}
 * objects, and the same logical field appears at different array indices depending on what's
 * present) — too irregular to validate as one nested schema. Instead, normalize.ts walks the
 * raw shape with defensive extraction helpers, and what those helpers *produce* — the flat
 * DTOs below — is what gets validated. That's the boundary that matters: it's exactly the
 * data downstream code (persistence, pricing) consumes.
 */

export const yahooLeagueDtoSchema = z.object({
  leagueKey: z.string(),
  name: z.string(),
  season: z.number(),
  teamCount: z.number().nullable(),
  ownTeamKey: z.string(),
});
export type YahooLeagueDto = z.infer<typeof yahooLeagueDtoSchema>;

export const yahooRosterPlayerDtoSchema = z.object({
  providerPlayerId: z.string(),
  name: z.string(),
  position: z.string().nullable(),
  nflTeam: z.string().nullable(),
  slot: z.enum(["STARTER", "BENCH", "IR"]),
});
export type YahooRosterPlayerDto = z.infer<typeof yahooRosterPlayerDtoSchema>;

export const yahooDraftPickDtoSchema = z.object({
  round: z.number(),
  pickNo: z.number(),
  providerPlayerId: z.string().nullable(),
});
export type YahooDraftPickDto = z.infer<typeof yahooDraftPickDtoSchema>;
