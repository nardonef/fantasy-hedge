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
    <div className="mx-auto flex max-w-xl flex-1 flex-col gap-8 px-6 py-16">
      <h1 className="text-2xl font-semibold">Connect your leagues</h1>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">Sleeper</h2>
        {hasSleeper ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Sleeper account connected.</p>
        ) : null}
        <SleeperConnectForm />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">Yahoo</h2>
        {hasYahoo ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Yahoo account connected.</p>
        ) : (
          <a
            href="/api/auth/yahoo"
            className="inline-block w-fit rounded bg-foreground px-4 py-2 text-background"
          >
            Connect Yahoo
          </a>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">Your leagues</h2>
        {connectedLeagues.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No leagues connected yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {connectedLeagues.map((l) => (
              <li key={l.id}>
                <Link href={`/leagues/${l.id}`} className="underline">
                  {l.name} ({l.provider}, {l.season})
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
