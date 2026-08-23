import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { runGamePropSettlements } from "@/lib/settlement/run-game-prop-settlements";
import { createNflverseStatsFeedClient } from "@/lib/stats-feed/nflverse/nflverse-client";

const statsFeed = createNflverseStatsFeedClient();

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
