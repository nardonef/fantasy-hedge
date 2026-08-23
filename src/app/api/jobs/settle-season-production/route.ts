import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { runSeasonProductionSettlements } from "@/lib/settlement/run-season-production-settlements";
import { createMockStatsFeedClient } from "@/lib/stats-feed/mock-client";

// TODO(Phase 5): swap for a real StatsFeedClient once a sports-data vendor is chosen.
const statsFeed = createMockStatsFeedClient({});

/** Cron-triggered — see src/app/api/jobs/settle-game-props/route.ts for the auth rationale. */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const results = await runSeasonProductionSettlements(statsFeed);
  return NextResponse.json({ results });
}
