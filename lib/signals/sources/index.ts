import type { LaFoodTrendsDataFile } from "@/types/laFoodTrend";
import type { TrendSignal } from "@/lib/signals/types";
import { getEditorialSignals } from "@/lib/signals/sources/editorialSignals";
import { getGooglePlacesSignals } from "@/lib/signals/sources/googlePlacesSignals";
import { getRedditSignals } from "@/lib/signals/sources/redditSignals";
import { getReservationSignals } from "@/lib/signals/sources/reservationSignals";

export async function gatherSignals(data: LaFoodTrendsDataFile, nowIso: string): Promise<TrendSignal[]> {
  const [editorial, reddit, places, reservations] = await Promise.all([
    getEditorialSignals(data, nowIso),
    getRedditSignals(),
    getGooglePlacesSignals(),
    getReservationSignals(),
  ]);
  return [...editorial, ...reddit, ...places, ...reservations];
}
