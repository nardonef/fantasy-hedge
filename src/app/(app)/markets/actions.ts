"use server";

import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { buyContract as buyContractForUser } from "@/lib/trading";

export async function buyContract(
  contractId: string,
  quantity: number,
): Promise<{ tradeId: string; balanceAfter: number }> {
  const { userId: clerkId } = await auth();
  if (!clerkId) throw new Error("Not signed in");

  const [dbUser] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (!dbUser) throw new Error("No local user record yet — try signing out and back in");

  const result = await buyContractForUser(dbUser.id, contractId, quantity);

  revalidatePath(`/markets/${result.marketId}`);
  revalidatePath("/wallet");
  return { tradeId: result.tradeId, balanceAfter: result.balanceAfter };
}
