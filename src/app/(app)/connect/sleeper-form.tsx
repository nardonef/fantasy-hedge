"use client";

import { useState, useTransition } from "react";
import { connectSleeper } from "./actions";

export function SleeperConnectForm() {
  const [username, setUsername] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        setMessage(null);
        startTransition(async () => {
          const result = await connectSleeper(username);
          if (result.ok) {
            const { leaguesSynced } = result.data;
            setMessage(`Synced ${leaguesSynced} league${leaguesSynced === 1 ? "" : "s"}.`);
          } else {
            setMessage(result.error);
          }
        });
      }}
    >
      <label htmlFor="sleeper-username" className="text-sm font-medium">
        Sleeper username
      </label>
      <div className="flex gap-2">
        <input
          id="sleeper-username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="flex-1 h-11 rounded-[9px] border border-input-border bg-input-bg px-3 placeholder:text-placeholder"
          placeholder="your-sleeper-username"
        />
        <button
          type="submit"
          disabled={isPending}
          className="h-11 rounded-[9px] bg-hedge px-5 font-semibold text-[#0a0a0b] disabled:opacity-50"
        >
          {isPending ? "Connecting…" : "Connect"}
        </button>
      </div>
      {message && <p className="text-sm text-chalk-faint">{message}</p>}
    </form>
  );
}
