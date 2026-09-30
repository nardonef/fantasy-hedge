import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { leagues, providerAccounts, users } from "@/db/schema";
import { SleeperConnectForm } from "./sleeper-form";

export default async function ConnectPage() {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in");

  const [dbUser] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);

  const accounts = dbUser
    ? await db.select().from(providerAccounts).where(eq(providerAccounts.userId, dbUser.id))
    : [];

  const connectedLeagues = dbUser
    ? await db
        .select({
          id: leagues.id,
          name: leagues.name,
          provider: leagues.provider,
          season: leagues.season,
        })
        .from(leagues)
        .innerJoin(providerAccounts, eq(leagues.providerAccountId, providerAccounts.id))
        .where(eq(providerAccounts.userId, dbUser.id))
    : [];

  const hasYahoo = accounts.some((a) => a.provider === "yahoo");
  const hasSleeper = accounts.some((a) => a.provider === "sleeper");

  return (
    <div className="mx-auto flex max-w-xl flex-1 flex-col gap-8 px-6 py-12">
      <h1 className="text-4xl font-semibold leading-none tracking-[-0.04em]">Connect your leagues</h1>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold tracking-[-0.025em]">Sleeper</h2>
        {hasSleeper ? (
          <p className="text-sm text-chalk-faint">Sleeper account connected.</p>
        ) : null}
        <SleeperConnectForm />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold tracking-[-0.025em]">Yahoo</h2>
        {hasYahoo ? (
          <p className="text-sm text-chalk-faint">Yahoo account connected.</p>
        ) : (
          <a
            href="/api/auth/yahoo"
            className="inline-flex h-11 w-fit items-center rounded-[9px] bg-hedge px-5 font-semibold text-[#0a0a0b]"
          >
            Connect Yahoo
          </a>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold tracking-[-0.025em]">Your leagues</h2>
        {connectedLeagues.length === 0 ? (
          <p className="text-sm text-chalk-faint">No leagues connected yet.</p>
        ) : (
          <ul className="border-t border-hairline">
            {connectedLeagues.map((l) => (
              <li key={l.id}>
                <Link
                  href={`/leagues/${l.id}`}
                  className="flex items-baseline justify-between gap-4 border-b border-hairline px-3 py-3.5 hover:bg-[#0c0c0f]"
                >
                  <span className="font-semibold">{l.name}</span>
                  <span className="font-mono text-xs text-chalk-dim">
                    {l.provider} · {l.season}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
