import type { Comparator } from "@/db/schema";

const SYMBOLS: Record<Comparator, string> = {
  OVER: ">",
  UNDER: "<",
  AT_LEAST: "≥",
  EXACTLY: "=",
};

export function comparatorSymbol(comparator: Comparator): string {
  return SYMBOLS[comparator];
}
