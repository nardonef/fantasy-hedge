import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { grantSignupBonus } from "@/lib/wallet";

export async function POST(req: NextRequest) {
  const event = await verifyWebhook(req).catch(() => null);
  if (!event) {
    return new Response("Invalid webhook signature", { status: 400 });
  }

  if (event.type === "user.deleted") {
    if (event.data.id) {
      await db.delete(users).where(eq(users.clerkId, event.data.id));
    }
    return new Response(null, { status: 200 });
  }

  if (event.type !== "user.created" && event.type !== "user.updated") {
    return new Response(null, { status: 200 });
  }

  const { data } = event;
  const primaryEmail = data.email_addresses.find(
    (e) => e.id === data.primary_email_address_id,
  )?.email_address;
  if (!primaryEmail) {
    return new Response("No primary email on Clerk user", { status: 400 });
  }

  const name = [data.first_name, data.last_name].filter(Boolean).join(" ") || null;

  const [user] = await db
    .insert(users)
    .values({
      clerkId: data.id,
      email: primaryEmail,
      name,
      avatarUrl: data.image_url,
    })
    .onConflictDoUpdate({
      target: users.clerkId,
      set: { email: primaryEmail, name, avatarUrl: data.image_url, updatedAt: new Date() },
    })
    .returning();

  if (event.type === "user.created") {
    await grantSignupBonus(user.id);
  }

  return new Response(null, { status: 200 });
}
