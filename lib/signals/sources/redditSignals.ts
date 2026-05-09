import type { TrendSignal } from "@/lib/signals/types";

/**
 * Placeholder adapter for normalized Reddit signals.
 * Future implementation should map `lib/sources/reddit.ts` outputs into TrendSignal rows.
 */
export async function getRedditSignals(): Promise<TrendSignal[]> {
  return [];
}
