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
        className="h-11 rounded-[9px] bg-hedge px-5 font-semibold text-[#0a0a0b] disabled:opacity-50"
        onClick={() =>
          startTransition(async () => {
            const result = await claimSignupBonus();
            if (result.ok) {
              setMessage(`Balance: ${(result.data.balance / 100).toFixed(2)}`);
            } else {
              setMessage(result.error);
            }
          })
        }
      >
        {isPending ? "Claiming…" : "Claim signup bonus"}
      </button>
      {message && <p className="text-sm text-chalk-faint">{message}</p>}
    </div>
  );
}
