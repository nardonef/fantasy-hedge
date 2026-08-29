import { Show, SignInButton, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { isAdmin } from "@/lib/admin";

export async function NavBar() {
  const admin = await isAdmin();

  return (
    <header className="flex items-center justify-between border-b border-zinc-200 px-6 py-3 dark:border-zinc-800">
      <Link href="/" className="font-semibold">
        Fantasy Hedge
      </Link>
      <Show when="signed-in">
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/connect" className="hover:underline">
            Connect
          </Link>
          <Link href="/markets" className="hover:underline">
            Markets
          </Link>
          <Link href="/wallet" className="hover:underline">
            Wallet
          </Link>
          {admin && (
            <Link href="/admin/settlements" className="hover:underline">
              Admin
            </Link>
          )}
          <UserButton />
        </nav>
      </Show>
      <Show when="signed-out">
        <SignInButton>
          <button type="button" className="text-sm hover:underline">
            Sign in
          </button>
        </SignInButton>
      </Show>
    </header>
  );
}
