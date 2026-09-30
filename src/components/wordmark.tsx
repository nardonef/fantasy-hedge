import Link from "next/link";

const DOT_COLOR = { hedge: "bg-hedge", rankings: "bg-rankings" } as const;

export function Wordmark({ tool, size = 20 }: { tool: keyof typeof DOT_COLOR; size?: number }) {
  return (
    <Link
      href="/"
      style={{ fontSize: size }}
      className="font-semibold tracking-[-0.045em] text-chalk"
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
