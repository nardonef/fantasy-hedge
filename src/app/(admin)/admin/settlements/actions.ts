"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { type ActionResult, toActionResult } from "@/lib/action-result";
import { manuallySettleMarket as manuallySettleMarketForMarket, manuallyVoidMarket as manuallyVoidMarketForMarket } from "@/lib/settlement/manual-override";

export async function manuallySettleMarket(
  marketId: string,
  winningContractId: string,
): Promise<ActionResult<void>> {
  return toActionResult(async () => {
    await requireAdmin();
    await manuallySettleMarketForMarket(marketId, winningContractId);
    revalidatePath("/admin/settlements");
  });
}

export async function manuallyVoidMarket(marketId: string): Promise<ActionResult<void>> {
  return toActionResult(async () => {
    await requireAdmin();
    await manuallyVoidMarketForMarket(marketId);
    revalidatePath("/admin/settlements");
  });
}
