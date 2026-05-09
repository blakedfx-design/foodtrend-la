import type { TrendSignal } from "@/lib/signals/types";

/**
 * Placeholder adapter for reservation-derived signals (Resy/OpenTable/etc).
 * Intentionally empty until APIs/connectors are added.
 */
export async function getReservationSignals(): Promise<TrendSignal[]> {
  return [];
}
