"use server";

import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { grantSignupBonus } from "@/lib/wallet";

/**
 * Manually (re-)claims the signup bonus. Idempotent — safe to call even if the Clerk webhook
 * already granted it; this is the self-heal path if that webhook ever fails to fire.
 */
export async function claimSignupBonus(): Promise<{ balance: number }> {
  const { userId: clerkId } = await auth();
  if (!clerkId) throw new Error("Not signed in");

  const [dbUser] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (!dbUser) throw new Error("No local user record yet — try signing out and back in");

  const entry = await grantSignupBonus(dbUser.id);
  revalidatePath("/wallet");
  return { balance: entry.balanceAfter };
}
