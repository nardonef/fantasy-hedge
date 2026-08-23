"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { manuallySettleMarket as manuallySettleMarketForMarket, manuallyVoidMarket as manuallyVoidMarketForMarket } from "@/lib/settlement/manual-override";

export async function manuallySettleMarket(marketId: string, winningContractId: string): Promise<void> {
  await requireAdmin();
  await manuallySettleMarketForMarket(marketId, winningContractId);
  revalidatePath("/admin/settlements");
}

export async function manuallyVoidMarket(marketId: string): Promise<void> {
  await requireAdmin();
  await manuallyVoidMarketForMarket(marketId);
  revalidatePath("/admin/settlements");
}
