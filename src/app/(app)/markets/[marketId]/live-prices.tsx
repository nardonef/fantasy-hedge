"use client";

import { useEffect, useState, useTransition } from "react";
import { buyContract } from "../actions";

type ContractPrice = { id: string; label: string; currentPrice: number };

const POLL_INTERVAL_MS = 8000;

export function LivePrices({
  marketId,
  initialContracts,
  initialStatus,
}: {
  marketId: string;
  initialContracts: ContractPrice[];
  initialStatus: string;
}) {
  const [contractsState, setContracts] = useState(initialContracts);
  const [status, setStatus] = useState(initialStatus);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const interval = setInterval(async () => {
      const res = await fetch(`/api/markets/${marketId}/prices`);
      if (!res.ok) return;
      const data = await res.json();
      setContracts(data.contracts);
      setStatus(data.status);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [marketId]);

  return (
    <div className="flex flex-col gap-4">
      {contractsState.map((c) => (
        <div key={c.id} className="flex items-center justify-between gap-4 rounded border border-zinc-300 p-3 dark:border-zinc-700">
          <div>
            <p className="font-medium">{c.label}</p>
            <p className="font-mono text-sm text-zinc-600 dark:text-zinc-400">{c.currentPrice.toFixed(3)}</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              step={1}
              value={quantities[c.id] ?? 1}
              onChange={(e) =>
                setQuantities((prev) => ({ ...prev, [c.id]: Math.max(1, Number(e.target.value)) }))
              }
              className="w-16 rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900"
            />
            <button
              type="button"
              disabled={isPending || status !== "OPEN"}
              className="rounded bg-foreground px-3 py-1 text-background disabled:opacity-50"
              onClick={() =>
                startTransition(async () => {
                  setMessage(null);
                  try {
                    const { balanceAfter } = await buyContract(c.id, quantities[c.id] ?? 1);
                    setMessage(`Bought. New balance: ${(balanceAfter / 100).toFixed(2)}`);
                  } catch (error) {
                    setMessage(error instanceof Error ? error.message : "Trade failed");
                  }
                })
              }
            >
              {isPending ? "Buying…" : "Buy"}
            </button>
          </div>
        </div>
      ))}
      {status !== "OPEN" && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Market is {status.toLowerCase()}.</p>
      )}
      {message && <p className="text-sm text-zinc-600 dark:text-zinc-400">{message}</p>}
    </div>
  );
}
