"use server";

import { revalidatePath } from "next/cache";
import { type ActionResult, toActionResult } from "@/lib/action-result";
import { requireDbUser } from "@/lib/current-user";
import { buyContract as buyContractForUser } from "@/lib/trading";

export async function buyContract(
  contractId: string,
  quantity: number,
): Promise<ActionResult<{ tradeId: string; balanceAfter: number }>> {
  return toActionResult(async () => {
    const dbUser = await requireDbUser();
    const result = await buyContractForUser(dbUser.id, contractId, quantity);

    revalidatePath(`/markets/${result.marketId}`);
    revalidatePath("/wallet");
    return { tradeId: result.tradeId, balanceAfter: result.balanceAfter };
  });
}
