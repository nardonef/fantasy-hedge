import { SignIn } from "@clerk/nextjs";
import { AuthBrandPanel } from "@/components/auth/auth-brand-panel";
import { AuthFooter } from "@/components/auth/auth-footer";
import { signInKicker } from "@/lib/auth-kicker";
import { hedgeAppearance } from "@/lib/clerk-appearance";
import { getOpenMarketsSummary } from "@/lib/open-markets-summary";

export const metadata = { title: "Sign in · fantasy·hedge" };

export default async function SignInPage() {
  const summary = await getOpenMarketsSummary();

  return (
    <main className="grid min-h-svh bg-page lg:grid-cols-[1.1fr_1fr]">
      <AuthBrandPanel
        kicker={signInKicker(summary)}
        headline="Your roster is exposed"
        body="Hedge real NFL outcomes against your lineup. The coins are virtual. The Sunday-morning injury report is not."
      />
      <section className="relative flex items-end justify-center px-6 pb-16 pt-7 lg:items-center lg:p-10">
        <SignIn appearance={hedgeAppearance} />
        <AuthFooter />
      </section>
    </main>
  );
}
