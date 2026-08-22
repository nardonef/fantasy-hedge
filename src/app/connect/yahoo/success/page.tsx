import Link from "next/link";

export default function YahooConnectedPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
      <h1 className="text-2xl font-semibold">Yahoo connected</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        Your Yahoo leagues have been synced.
      </p>
      <Link href="/connect" className="underline">
        Back to connections
      </Link>
    </div>
  );
}
