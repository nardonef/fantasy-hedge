# Fantasy Hedge

A fantasy-football-specific hedging platform: connect a Sleeper or Yahoo league and hedge
real NFL outcomes — single-game player props, season-long production hedges, and
injury-protection contracts — against your roster.

Virtual currency only for now. See `docs/decisions/0001-virtual-currency-only.md` and
`CLAUDE.md` for the full architecture and rules.

## Getting started

```bash
cp .env.example .env   # fill in DATABASE_URL, Clerk keys, Yahoo OAuth credentials
pnpm install
pnpm db:migrate
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Commands

- `pnpm dev` / `pnpm build` / `pnpm start`
- `pnpm typecheck` · `pnpm lint` · `pnpm test` · `pnpm test:e2e`
- `pnpm db:generate` / `pnpm db:migrate` / `pnpm db:studio`
