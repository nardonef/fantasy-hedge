import { Show, SignInButton } from "@clerk/nextjs";
import Link from "next/link";

const CTA = "h-11 rounded-[9px] bg-hedge px-5 font-semibold text-[#0a0a0b]";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
      <p className="kicker text-hedge">Virtual coins · real anxiety</p>
      <h1 className="text-[56px] font-semibold leading-[0.95] tracking-[-0.05em]">
        Fantasy Hedge
      </h1>
      <p className="max-w-md text-lg text-chalk-dim">
        Hedge your fantasy football roster against real NFL outcomes.
      </p>
      <Show when="signed-out">
        <SignInButton>
          <button type="button" className={CTA}>
            Sign in
          </button>
        </SignInButton>
      </Show>
      <Show when="signed-in">
        <Link href="/connect" className={`${CTA} inline-flex items-center`}>
          Connect your league
        </Link>
      </Show>
    </div>
  );
}
