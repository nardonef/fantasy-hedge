import { Wordmark } from "@/components/wordmark";

const TICKET = "flex w-[420px] flex-col gap-2.5 rounded-xl border p-[18px]";

function TicketStack() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute -right-15 left-12 top-[150px] flex -rotate-4 flex-col gap-3 opacity-90 max-lg:hidden"
    >
      <div className={`${TICKET} border-hedge/25 bg-raised-2 shadow-[inset_3px_0_0_var(--hedge)]`}>
        <div className="flex items-center justify-between">
          <span className="kicker text-[10px] text-hedge">INJURY PROTECTION</span>
          <span className="pill border-hedge/40 text-hedge">OPEN</span>
        </div>
        <p className="text-[18px] font-semibold">Bijan misses 2+ games</p>
        <div className="flex items-center justify-between border-t border-hairline pt-2.5 font-mono text-[13px]">
          <span className="text-chalk-faint">0.140 · ▲ 0.012</span>
          <span className="text-hedge">PAYS 1,000</span>
        </div>
      </div>
      <div className={`${TICKET} ml-10 border-hairline bg-[#0e0e11] blur-[1.5px]`}>
        <span className="kicker text-[10px] text-chalk-faint">GAME PROP</span>
        <p className="text-[18px] font-semibold">████ █████ ≥ 275.5 pass yds</p>
        <div className="flex items-center justify-between border-t border-hairline pt-2.5 font-mono text-[13px] text-chalk-faint">
          <span>0.540</span>
          <span>LOCKS SUN 1:00</span>
        </div>
      </div>
      <div className={`${TICKET} ml-20 h-24 border-hairline bg-[#0e0e11] opacity-55 blur-[4px]`} />
      <div
        className={`${TICKET} ml-[120px] h-24 border-hairline bg-[#0e0e11] opacity-30 blur-[6px]`}
      />
      <div className="absolute inset-x-0 top-[120px] h-[440px] bg-gradient-to-b from-transparent from-40% to-field to-92%" />
    </div>
  );
}

export function AuthBrandPanel({
  kicker,
  headline,
  body,
}: {
  kicker: string;
  headline: string;
  body: string;
}) {
  return (
    <div className="relative flex flex-col justify-between overflow-hidden px-6 pt-14 lg:border-r lg:border-hairline lg:bg-field lg:px-12 lg:py-10">
      <Wordmark tool="hedge" size={22} />
      <TicketStack />
      <div className="relative mt-7 flex flex-col gap-[18px] lg:mt-0">
        <p className="kicker text-hedge">{kicker}</p>
        <h1 className="text-[42px] font-semibold leading-[0.9] tracking-[-0.055em] lg:text-[64px]">
          {headline}
          <span
            aria-hidden
            className="ml-[0.06em] inline-block size-[0.17em] rounded-full bg-hedge"
          />
        </h1>
        <p className="max-w-[430px] text-[17px] leading-normal text-chalk-dim max-lg:hidden">
          {body}
        </p>
      </div>
    </div>
  );
}
