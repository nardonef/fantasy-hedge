import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";

function adminEmails(): string[] {
  return (process.env.ADMIN_USER_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** Throws unless the signed-in user's email is on the ADMIN_USER_EMAILS allowlist. */
export async function requireAdmin(): Promise<void> {
  const { userId: clerkId } = await auth();
  if (!clerkId) throw new Error("Not signed in");

  const [dbUser] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (!dbUser) throw new Error("No local user record");

  if (!adminEmails().includes(dbUser.email.toLowerCase())) {
    throw new Error("Not authorized");
  }
}
