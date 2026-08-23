import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { runGamePropSettlements } from "@/lib/settlement/run-game-prop-settlements";
import { createMockStatsFeedClient } from "@/lib/stats-feed/mock-client";

// TODO(Phase 5): swap for a real StatsFeedClient once a sports-data vendor is chosen. Until
// then this job has no games to resolve against — it's the wiring, not the data source.
const statsFeed = createMockStatsFeedClient({ gameStatuses: {}, playerGameStats: {} });

/**
 * Cron-triggered, not user-triggered — exempted from Clerk session auth in proxy.ts, so it's
 * gated by its own shared secret instead. Settlement is idempotent (already-settled markets
 * are excluded by status), but an unauthenticated caller could still force runs at will.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const results = await runGamePropSettlements(statsFeed);
  return NextResponse.json({ results });
}
