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

/** True if the signed-in user's email is on the ADMIN_USER_EMAILS allowlist. False if signed out. */
export async function isAdmin(): Promise<boolean> {
  const { userId: clerkId } = await auth();
  if (!clerkId) return false;

  const [dbUser] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (!dbUser) return false;

  return adminEmails().includes(dbUser.email.toLowerCase());
}

/** Throws unless the signed-in user's email is on the ADMIN_USER_EMAILS allowlist. */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) {
    throw new Error("Not authorized");
  }
}
