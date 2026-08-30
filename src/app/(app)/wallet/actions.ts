"use server";

import { revalidatePath } from "next/cache";
import { type ActionResult, toActionResult } from "@/lib/action-result";
import { requireDbUser } from "@/lib/current-user";
import { grantSignupBonus } from "@/lib/wallet";

/**
 * Manually (re-)claims the signup bonus. Idempotent — safe to call even if the Clerk webhook
 * already granted it; this is the self-heal path if that webhook ever fails to fire.
 */
export async function claimSignupBonus(): Promise<ActionResult<{ balance: number }>> {
  return toActionResult(async () => {
    const dbUser = await requireDbUser();
    const entry = await grantSignupBonus(dbUser.id);
    revalidatePath("/wallet");
    return { balance: entry.balanceAfter };
  });
}
