import { Show, SignInButton } from "@clerk/nextjs";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-zinc-50 px-6 text-center dark:bg-black">
      <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
        Fantasy Hedge
      </h1>
      <p className="max-w-md text-lg text-zinc-600 dark:text-zinc-400">
        Hedge your fantasy football roster against real NFL outcomes.
      </p>
      <Show when="signed-out">
        <SignInButton>
          <button
            type="button"
            className="rounded-full bg-foreground px-5 py-3 text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
          >
            Sign in
          </button>
        </SignInButton>
      </Show>
      <Show when="signed-in">
        <Link
          href="/connect"
          className="rounded-full bg-foreground px-5 py-3 text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
        >
          Connect your league
        </Link>
      </Show>
    </div>
  );
}
