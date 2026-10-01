import Link from "next/link";

export default function YahooConnectedPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
      <h1 className="text-4xl font-semibold leading-none tracking-[-0.04em]">Yahoo connected</h1>
      <p className="text-chalk-faint">
        Your Yahoo leagues have been synced.
      </p>
      <Link href="/connect" className="text-chalk-dim hover:text-chalk">
        Back to connections
      </Link>
    </div>
  );
}
