"use client";

import { useState, useTransition } from "react";
import { manuallySettleMarket, manuallyVoidMarket } from "./actions";

type ContractOption = { id: string; label: string };

export function SettleForm({ marketId, contracts }: { marketId: string; contracts: ContractOption[] }) {
  const [selected, setSelected] = useState<string>(contracts[0]?.id ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-2 rounded border border-zinc-300 p-3 dark:border-zinc-700">
      <fieldset className="flex flex-wrap gap-3">
        {contracts.map((c) => (
          <label key={c.id} className="flex items-center gap-1 text-sm">
            <input
              type="radio"
              name={`winner-${marketId}`}
              checked={selected === c.id}
              onChange={() => setSelected(c.id)}
            />
            {c.label}
          </label>
        ))}
      </fieldset>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={isPending}
          className="rounded bg-foreground px-3 py-1 text-sm text-background disabled:opacity-50"
          onClick={() =>
            startTransition(async () => {
              setMessage(null);
              try {
                await manuallySettleMarket(marketId, selected);
                setMessage("Settled.");
              } catch (error) {
                setMessage(error instanceof Error ? error.message : "Failed to settle");
              }
            })
          }
        >
          Settle as winner
        </button>
        <button
          type="button"
          disabled={isPending}
          className="rounded border border-zinc-400 px-3 py-1 text-sm disabled:opacity-50"
          onClick={() =>
            startTransition(async () => {
              setMessage(null);
              try {
                await manuallyVoidMarket(marketId);
                setMessage("Voided.");
              } catch (error) {
                setMessage(error instanceof Error ? error.message : "Failed to void");
              }
            })
          }
        >
          Void (refund all)
        </button>
      </div>
      {message && <p className="text-sm text-zinc-600 dark:text-zinc-400">{message}</p>}
    </div>
  );
}
