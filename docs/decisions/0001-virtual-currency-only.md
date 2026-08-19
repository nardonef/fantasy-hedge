# 0001 — Virtual currency only, real money deferred

## Decision

Fantasy Hedge launches with a virtual (play-money) wallet only. No payment processing, no
deposits or withdrawals, no KYC/AML. Every user gets a signup grant of virtual currency to
trade positions with.

## Why

Real-money settlement on contracts tied to sports outcomes is a regulated activity in the
US — the CFTC has scrutinized sports-event contracts directly, and legality otherwise varies
state by state under gambling law. Neither question resolves by writing better code; both
require their own legal review before any real money touches this system.

## How this shapes the architecture

The wallet/ledger design (`ledgerEntries` as the source of truth, `wallets.balance` as a
derived cache) is built so real-money rails can be added later without a schema rewrite —
adding `REAL_DEPOSIT`/`REAL_WITHDRAWAL` ledger entry types is additive, not a migration.
But doing so is a product and legal decision, not an engineering one: it should get its own
decision record and review before it happens, not slide in implicitly the first time someone
wants a `REAL_DEPOSIT` row.

## Status

Active. Revisit only alongside a deliberate decision to support real money.
