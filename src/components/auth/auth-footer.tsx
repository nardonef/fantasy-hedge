const HUB_URL = "https://fantasy-eight-jet.vercel.app";

export function AuthFooter() {
  return (
    <div className="kicker absolute inset-x-6 bottom-7 flex items-center justify-between text-[9px] tracking-[0.16em] text-chalk-faintest lg:inset-x-10 lg:text-[10px]">
      <a href={HUB_URL} className="hover:text-chalk-dim">
        PART OF FANTASY <span className="text-signal">●</span>
      </a>
      <span>
        <span className="lg:hidden">VIRTUAL COINS ONLY</span>
        <span className="max-lg:hidden">VIRTUAL CURRENCY ONLY · SECURED BY CLERK</span>
      </span>
    </div>
  );
}
