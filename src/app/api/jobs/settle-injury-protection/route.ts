import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { runInjuryProtectionSettlements } from "@/lib/settlement/run-injury-protection-settlements";
import { createNflverseStatsFeedClient } from "@/lib/stats-feed/nflverse/nflverse-client";

const statsFeed = createNflverseStatsFeedClient();

/** Cron-triggered — see src/app/api/jobs/settle-game-props/route.ts for the auth rationale. */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const results = await runInjuryProtectionSettlements(statsFeed);
  return NextResponse.json({ results });
}
