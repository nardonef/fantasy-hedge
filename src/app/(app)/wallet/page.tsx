import { auth } from "@clerk/nextjs/server";
import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { ledgerEntries, users, wallets } from "@/db/schema";
import { ClaimBonusButton } from "./claim-bonus-button";

function formatAmount(minorUnits: number): string {
  return (minorUnits / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
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

  const [balanceWhole, balanceCents] = formatAmount(wallet?.balance ?? 0).split(".");

  return (
    <div className="mx-auto flex max-w-xl flex-1 flex-col gap-6 px-6 py-12">
      <div className="flex flex-col gap-3">
        <p className="kicker text-chalk-faint">Balance · virtual coins</p>
        <p className="font-mono text-[80px] font-medium leading-[0.9] tracking-[-0.045em]">
          {balanceWhole}
          <span className="text-chalk-muted">.{balanceCents}</span>
        </p>
      </div>

      {!wallet && <ClaimBonusButton />}

      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold tracking-[-0.025em]">History</h2>
        {entries.length === 0 ? (
          <p className="text-sm text-chalk-faint">No activity yet.</p>
        ) : (
          <ul>
            {entries.map((e) => (
              <li
                key={e.id}
                className="grid grid-cols-[1fr_auto] items-center gap-4 border-b border-hairline py-3"
              >
                <span
                  className={`font-mono text-[10px] uppercase tracking-[0.16em] ${
                    e.type === "SETTLEMENT_PAYOUT" ? "text-hedge" : "text-chalk-faint"
                  }`}
                >
                  {e.type.replaceAll("_", " ")}
                </span>
                <span
                  className={`font-mono text-[15px] ${
                    e.amount < 0 ? "text-regret" : e.type === "SETTLEMENT_PAYOUT" ? "text-hedge" : "text-chalk"
                  }`}
                >
                  {e.amount < 0 ? "−" : "+"}
                  {formatAmount(Math.abs(e.amount))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
