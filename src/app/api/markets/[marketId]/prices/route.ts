import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { contracts, markets } from "@/db/schema";

export async function GET(_req: Request, { params }: { params: Promise<{ marketId: string }> }) {
  const { marketId } = await params;

  const [market] = await db.select().from(markets).where(eq(markets.id, marketId)).limit(1);
  if (!market) return new NextResponse("Not found", { status: 404 });

  const marketContracts = await db.select().from(contracts).where(eq(contracts.marketId, marketId));

  return NextResponse.json({
    status: market.status,
    contracts: marketContracts.map((c) => ({ id: c.id, label: c.label, currentPrice: c.currentPrice })),
  });
}
