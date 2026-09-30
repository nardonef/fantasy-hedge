import Link from "next/link";

const DOT_COLOR = { hedge: "bg-hedge", rankings: "bg-rankings" } as const;

export function Wordmark({ tool }: { tool: keyof typeof DOT_COLOR }) {
  return (
    <Link
      href="/"
      className="text-[20px] font-semibold tracking-[-0.045em] text-chalk"
      aria-label={`fantasy ${tool}`}
    >
      fantasy
      <span
        aria-hidden
        className={`ml-[0.04em] mr-[0.14em] inline-block h-[0.2em] w-[0.2em] rounded-full ${DOT_COLOR[tool]}`}
      />
      <span className="text-chalk-dim">{tool}</span>
    </Link>
  );
}
