import { SignUp } from "@clerk/nextjs";
import { AuthBrandPanel } from "@/components/auth/auth-brand-panel";
import { AuthFooter } from "@/components/auth/auth-footer";
import { hedgeAppearance } from "@/lib/clerk-appearance";
import { formatCoins, SIGNUP_GRANT_AMOUNT } from "@/lib/wallet-constants";

export const metadata = { title: "Sign up · fantasy·hedge" };

export default function SignUpPage() {
  return (
    <main className="grid min-h-svh bg-page lg:grid-cols-[1.1fr_1fr]">
      <AuthBrandPanel
        kicker={`STARTING BALANCE · ${formatCoins(SIGNUP_GRANT_AMOUNT)} COINS`}
        headline="Hedge your roster before Sunday does"
        body="Connect your Sleeper or Yahoo league, then buy protection on the players you can't afford to lose."
      />
      <section className="relative flex items-end justify-center px-6 pb-16 pt-7 lg:items-center lg:p-10">
        <SignUp appearance={hedgeAppearance} />
        <AuthFooter />
      </section>
    </main>
  );
}
