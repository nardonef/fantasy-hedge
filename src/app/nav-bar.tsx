import { Show, SignInButton, UserButton } from "@clerk/nextjs";
import { Wordmark } from "@/components/wordmark";
import { isAdmin } from "@/lib/admin";
import { NavLinks } from "./nav-links";

export async function NavBar() {
  const admin = await isAdmin();

  return (
    <header className="flex items-center justify-between border-b border-hairline px-6 py-3.5">
      <Wordmark tool="hedge" />
      <Show when="signed-in">
        <nav className="flex items-center gap-[22px] text-sm">
          <NavLinks admin={admin} />
          <UserButton />
        </nav>
      </Show>
      <Show when="signed-out">
        <SignInButton>
          <button
            type="button"
            className="h-9 rounded-[9px] bg-chalk px-4 text-sm font-semibold text-[#0a0a0b]"
          >
            Sign in
          </button>
        </SignInButton>
      </Show>
    </header>
  );
}
