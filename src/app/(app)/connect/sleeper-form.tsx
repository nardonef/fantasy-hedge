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
          className="flex-1 rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          placeholder="your-sleeper-username"
        />
        <button
          type="submit"
          disabled={isPending}
          className="rounded bg-foreground px-4 py-2 text-background disabled:opacity-50"
        >
          {isPending ? "Connecting…" : "Connect"}
        </button>
      </div>
      {message && <p className="text-sm text-zinc-600 dark:text-zinc-400">{message}</p>}
    </form>
  );
}
