import type { TrendSignal } from "@/lib/signals/types";

/**
 * Placeholder adapter for normalized Google Places signals.
 * Future implementation should map weekend Places/search score evidence into TrendSignal rows.
 */
export async function getGooglePlacesSignals(): Promise<TrendSignal[]> {
  return [];
}
