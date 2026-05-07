import type { SocialSignalStrength, TrendSocialSignal } from "@/types/socialSignal";

type HeatLevel = "high" | "medium" | "low" | null;

const RANK: Record<SocialSignalStrength, number> = { high: 3, medium: 2, low: 1 };

function maxLevel(prev: HeatLevel, next: SocialSignalStrength): HeatLevel {
  const pr = prev ? RANK[prev] : 0;
  return RANK[next] > pr ? next : prev;
}

/** Set false to rely on “Most Spotted” / “Also Spotted” only (recommended for a quieter card). */
export const SHOW_EDITORIAL_MOMENTUM_CUE = false;

const KICKERS = [
  "Momentum",
  "Buzz",
  "Catching On",
  "In Rotation",
  "Seeing Everywhere",
] as const;

function stableKickerIndex(trendId: string): number {
  let h = 0;
  for (let i = 0; i < trendId.length; i++) {
    h = (h * 33 + trendId.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % KICKERS.length;
}

/** Short lines that suggest traction without naming channels or methodology. */
const DEK: Record<"high" | "medium" | "low", string> = {
  high: "Harder to overlook lately.",
  medium: "Showing a bit more life.",
  low: "Worth a longer look.",
};

export type MomentumCue = {
  kicker: string;
  dek: string;
};

/**
 * Builds a single-line editorial note from `socialSignals` strength only.
 * URLs and platforms are intentionally ignored in the UI.
 */
export function buildEditorialMomentumCue(
  trendId: string,
  signals: readonly TrendSocialSignal[],
): MomentumCue | null {
  if (!SHOW_EDITORIAL_MOMENTUM_CUE || signals.length === 0) {
    return null;
  }
  let peak: HeatLevel = null;
  for (const s of signals) {
    peak = maxLevel(peak, s.strength);
  }
  const tier = peak ?? "medium";
  return {
    kicker: KICKERS[stableKickerIndex(trendId)],
    dek: DEK[tier],
  };
}
