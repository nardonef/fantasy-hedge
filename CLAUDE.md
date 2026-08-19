# Fantasy Hedge

A fantasy-football-specific hedging platform: connect a Sleeper or Yahoo league, and hedge
real NFL outcomes that threaten your roster — a single-game player prop for tonight's
matchup, a season-long production hedge on a draft pick, or an injury-protection contract —
through fixed-odds, house-priced contracts settled against real game/season data.

Virtual currency only at this stage — see `docs/decisions/0001-virtual-currency-only.md`.

## Stack

- Next.js 16 (App Router, TypeScript strict); Tailwind v4
- Postgres via Drizzle (`src/db/schema/`); local Homebrew Postgres in dev, Neon in prod
- Clerk for auth (`src/middleware.ts`, `/api/webhooks/clerk` syncs the local `users` table)
- Biome (lint+format), Vitest (unit/integration), Playwright (e2e)
- pnpm, Node 22+

## Commands

- `pnpm dev` / `pnpm build` / `pnpm start`
- `pnpm typecheck` · `pnpm lint` (Biome) · `pnpm test` (Vitest) · `pnpm test:e2e` (Playwright)
- `pnpm db:generate` → new migration from schema change; `pnpm db:migrate` → apply
- `.env`: see `.env.example` — `DATABASE_URL`, Clerk keys, Yahoo OAuth app credentials

## Architecture

    Sleeper/Yahoo API → provider adapter (normalize) → Postgres
                                                            │
    market pricing (per market type) ──► contracts, positions, ledger (virtual wallet)
                                                            │
    settlement job (per market type) ──► StatsFeedClient → settlements + ledger payouts

- `src/providers/` — one adapter per platform (sleeper, yahoo). Adapters are the only code
  that sees provider-shaped data; they validate with zod and emit a `Normalized*` bundle.
  Raw payloads are stored in jsonb so ingestion can be re-run without re-fetching.
- `src/db/schema/` — one file per table group (`users`, `providers`, `leagues`, `players`,
  `markets`, `wallet`, `positions`, `settlements`, `games`), barrel-exported from `index.ts`.
- `src/lib/pricing/` and `src/lib/settlement/` — pure functions, one pair per market type
  (`GAME_PROP`, `SEASON_PRODUCTION`, `INJURY_PROTECTION`). No I/O, no `Date.now()`, no
  randomness — settlement math must be independently verifiable and testable.
- `src/lib/stats-feed/` — the `StatsFeedClient` interface settlement jobs depend on. A mock
  client backs it until a real sports-data vendor is chosen (Phase 5); swapping vendors means
  a new file implementing the interface, not touching settlement logic.
- `ledgerEntries` is the source of truth for money; `wallets.balance` is a derived, reconciled
  cache. Every mutation is an idempotent ledger write (`idempotencyKey`), never a bare
  `UPDATE ... balance`.
- Markets are global (one market per player/game/season, shared by all users), not scoped to
  a connected league — hedge value comes from real NFL outcomes, not league scoring settings.
  League/roster data only surfaces which markets are relevant to a given user.

## Rules

- Pricing and settlement functions must stay pure and deterministic — this is what makes a
  payout auditable after the fact. No I/O, no randomness inside them.
- Never trust provider data shape; adapters validate with zod and fail loudly.
- `settlements.resolutionData` must capture the raw stat/injury snapshot a payout was computed
  from — "how it resolved and why" is a product requirement, not an afterthought.
- Tests are part of the same unit of work as the code: unit tests for pricing/settlement/ledger
  math, integration tests for anything touching the DB or an external service, fixture-driven
  tests wherever a payload shape is fragile (Yahoo's nested JSON, a stats vendor's box score).
- No real-money code path (payments, KYC, deposits/withdrawals) without a new decision record
  in `docs/decisions/` reviewing the regulatory implications first.
