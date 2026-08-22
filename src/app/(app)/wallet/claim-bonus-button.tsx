"use client";

import { useState, useTransition } from "react";
import { claimSignupBonus } from "./actions";

export function ClaimBonusButton() {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        disabled={isPending}
        className="rounded bg-foreground px-4 py-2 text-background disabled:opacity-50"
        onClick={() =>
          startTransition(async () => {
            try {
              const { balance } = await claimSignupBonus();
              setMessage(`Balance: ${(balance / 100).toFixed(2)}`);
            } catch (error) {
              setMessage(error instanceof Error ? error.message : "Failed to claim bonus");
            }
          })
        }
      >
        {isPending ? "Claiming…" : "Claim signup bonus"}
      </button>
      {message && <p className="text-sm text-zinc-600 dark:text-zinc-400">{message}</p>}
    </div>
  );
}
