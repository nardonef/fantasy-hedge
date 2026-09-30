const FALLBACK = "VIRTUAL COINS · REAL ANXIETY";

export function signInKicker(summary: { week: number | null; openCount: number } | null): string {
  if (!summary || summary.week === null || summary.openCount === 0) return FALLBACK;
  return `WEEK ${summary.week} · ${summary.openCount} MARKETS OPEN`;
}
