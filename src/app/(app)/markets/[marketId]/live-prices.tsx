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
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
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
    <div className="flex flex-col gap-3">
      {contractsState.map((c) => (
        <div
          key={c.id}
          className="flex items-center justify-between gap-3 rounded-xl border border-[#22222a] bg-raised-2 p-3.5"
        >
          <div className="flex flex-col gap-1">
            <p className="text-base font-semibold">{c.label}</p>
            <p className="font-mono text-[22px] font-medium">{c.currentPrice.toFixed(3)}</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              step={1}
              aria-label={`Quantity for ${c.label}`}
              value={quantities[c.id] ?? 1}
              onChange={(e) =>
                setQuantities((prev) => ({ ...prev, [c.id]: Math.max(1, Number(e.target.value)) }))
              }
              className="h-[38px] w-14 rounded-lg border border-input-border bg-input-bg text-center font-mono"
            />
            <button
              type="button"
              disabled={isPending || status !== "OPEN"}
              className="h-[38px] rounded-lg bg-hedge px-4 font-mono text-xs font-medium uppercase tracking-[0.16em] text-[#0a0a0b] disabled:opacity-40"
              onClick={() =>
                startTransition(async () => {
                  setMessage(null);
                  const result = await buyContract(c.id, quantities[c.id] ?? 1);
                  if (result.ok) {
                    setMessage({ ok: true, text: (result.data.balanceAfter / 100).toFixed(2) });
                  } else {
                    setMessage({ ok: false, text: result.error });
                  }
                })
              }
            >
              {isPending ? "Buying…" : "Buy"}
            </button>
          </div>
        </div>
      ))}
      {message && (
        <p
          className={`flex h-11 items-center gap-2.5 rounded-[9px] border px-3.5 text-sm ${
            message.ok ? "border-hedge/25 bg-hedge/[.08]" : "border-regret/25 bg-regret/[.08]"
          }`}
        >
          {message.ok && <span aria-hidden className="size-[7px] rounded-full bg-hedge" />}
          {message.ok ? (
            <span>
              Bought. New balance: <span className="font-mono">{message.text}</span>
            </span>
          ) : (
            message.text
          )}
        </p>
      )}
      <p className="kicker flex items-center gap-2 text-chalk-muted">
        {status === "OPEN" ? (
          <>
            <span aria-hidden className="size-[7px] rounded-full bg-[#4cd48f]" />
            OPEN · PRICES REFRESH EVERY {POLL_INTERVAL_MS / 1000}S
          </>
        ) : (
          <>
            <span aria-hidden className="size-[7px] rounded-full bg-[#71717a]" />
            MARKET IS {status}
          </>
        )}
      </p>
      <p className="text-[13px] text-chalk-muted">Virtual coins only. Hope you never collect.</p>
    </div>
  );
}
