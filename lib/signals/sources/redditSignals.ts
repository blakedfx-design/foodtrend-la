import type { TrendSignal } from "@/lib/signals/types";

/**
 * When false, Reddit must not be cited in public-facing convergence copy (adapter is stub / offline).
 * Set true only after `getRedditSignals` is wired to real ingest and ops approves public attribution.
 */
export function isRedditLiveInPipeline(): boolean {
  return false;
}

/** True when Reddit signals merge into the normalized pipeline and env is configured; drives public copy attribution. */
export function isRedditApprovedForPublicNarrative(): boolean {
  if (!isRedditLiveInPipeline()) return false;
  const id = process.env.REDDIT_CLIENT_ID?.trim();
  const secret = process.env.REDDIT_CLIENT_SECRET?.trim();
  const ua = process.env.REDDIT_USER_AGENT?.trim();
  return Boolean(id && secret && ua);
}

/**
 * Placeholder adapter for normalized Reddit signals.
 * Future implementation should map `lib/sources/reddit.ts` outputs into TrendSignal rows.
 */
export async function getRedditSignals(): Promise<TrendSignal[]> {
  return [];
}
