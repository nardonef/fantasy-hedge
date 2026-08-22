import { auth } from "@clerk/nextjs/server";
import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { ledgerEntries, users, wallets } from "@/db/schema";
import { ClaimBonusButton } from "./claim-bonus-button";

function formatAmount(minorUnits: number): string {
  return (minorUnits / 100).toFixed(2);
}

export default async function WalletPage() {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in");

  const [dbUser] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
  const wallet = dbUser
    ? (await db.select().from(wallets).where(eq(wallets.userId, dbUser.id)).limit(1))[0]
    : undefined;
  const entries = wallet
    ? await db
        .select()
        .from(ledgerEntries)
        .where(eq(ledgerEntries.walletId, wallet.id))
        .orderBy(desc(ledgerEntries.createdAt))
    : [];

  return (
    <div className="mx-auto flex max-w-xl flex-1 flex-col gap-6 px-6 py-16">
      <h1 className="text-2xl font-semibold">Wallet</h1>
      <p className="text-3xl font-mono">{formatAmount(wallet?.balance ?? 0)}</p>

      {!wallet && <ClaimBonusButton />}

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">History</h2>
        {entries.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No activity yet.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {entries.map((e) => (
              <li key={e.id} className="flex justify-between border-b border-zinc-100 py-1 dark:border-zinc-800">
                <span>{e.type}</span>
                <span className="font-mono">
                  {e.amount >= 0 ? "+" : ""}
                  {formatAmount(e.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
