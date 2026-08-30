import { auth, currentUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";

/**
 * Returns the signed-in user's local users row, creating it on demand from Clerk's own user
 * data if the user.created webhook hasn't synced it yet (or never will — e.g. the webhook
 * endpoint isn't configured for this deployment). Without this, a user whose webhook never
 * fired is permanently stuck: nothing they do client-side ("sign out and back in") re-triggers
 * a webhook that only ever fires once, at actual account creation.
 */
export async function requireDbUser() {
  const { userId: clerkId } = await auth();
  if (!clerkId) throw new Error("Not signed in");

  const [existing] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (existing) return existing;

  const clerkUser = await currentUser();
  if (!clerkUser) throw new Error("Not signed in");

  const primaryEmail = clerkUser.emailAddresses.find(
    (e) => e.id === clerkUser.primaryEmailAddressId,
  )?.emailAddress;
  if (!primaryEmail) throw new Error("Your Clerk account has no primary email address");

  const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || null;

  const [created] = await db
    .insert(users)
    .values({ clerkId, email: primaryEmail, name, avatarUrl: clerkUser.imageUrl })
    .onConflictDoUpdate({
      target: users.clerkId,
      set: { email: primaryEmail, name, avatarUrl: clerkUser.imageUrl, updatedAt: new Date() },
    })
    .returning();

  return created;
}
