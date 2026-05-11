import type { TrendSignal } from "@/lib/signals/types";
import type { LaFoodTrendsDataFile } from "@/types/laFoodTrend";

/**
 * Manual reservation rollup adapter.
 * Uses existing internal trend metadata only (no external reservation API calls).
 */
export async function getReservationSignals(
  data?: LaFoodTrendsDataFile,
): Promise<TrendSignal[]> {
  if (!data) return [];
  const nowIso = new Date().toISOString();
  const out: TrendSignal[] = [];
  const rows = [...(data.trends ?? []), ...(data.aboutToHit ?? [])];
  for (const trend of rows) {
    const reservationSignals = trend.reservationSignals ?? [];
    if (reservationSignals.length === 0) continue;
    const hasSocialCorroboration =
      (trend.manualSocialSignals?.instagramSpotted ?? false) ||
      (trend.manualSocialSignals?.tiktokSpotted ?? false) ||
      (trend.socialSignals ?? []).some((signal) => signal.platform === "instagram" || signal.platform === "tiktok");
    const hasGooglePlacesCorroboration =
      (trend.sources ?? []).some((source) => source.toLowerCase().includes("google")) ||
      (trend.evidenceSummary ?? "").toLowerCase().includes("google places");
    const hasEditorialCorroboration =
      (trend.sources ?? []).some((source) => {
        const s = source.toLowerCase();
        return (
          s.includes("eater") ||
          s.includes("infatuation") ||
          s.includes("la times") ||
          s.includes("resy") ||
          s.includes("bon appetit") ||
          s.includes("time out")
        );
      });
    const corroborated = hasSocialCorroboration || hasGooglePlacesCorroboration || hasEditorialCorroboration;
    const confidence = corroborated ? 0.46 : 0.31;

    for (const [idx, reservationSignal] of reservationSignals.entries()) {
      const exemplarRestaurant = trend.restaurants?.[0];
      const statusLabel = reservationSignal.status?.replaceAll("_", " ") ?? "reservation demand";
      const sourceLabel = reservationSignal.source;
      const entity = exemplarRestaurant?.name
        ? `${exemplarRestaurant.name} (${statusLabel})`
        : `${trend.name} (${statusLabel})`;
      out.push({
        id: `reservation_manual:${trend.id}:${sourceLabel}:${idx}`,
        source: "reservation",
        entityType: "restaurant",
        entity,
        confidence,
        velocity: corroborated ? 0.5 : 0.36,
        timestamp: nowIso,
        metadata: {
          trendId: trend.id,
          trendName: trend.name,
          neighborhoods:
            exemplarRestaurant?.neighborhood
              ? [exemplarRestaurant.neighborhood]
              : trend.neighborhoods ?? [],
          sourceLabel,
          reservationStatus: reservationSignal.status ?? null,
          reservationSourceUrl: reservationSignal.sourceUrl ?? null,
          reservationSourceNotes: reservationSignal.sourceNotes ?? null,
          observedAt: reservationSignal.observedAt ?? null,
          corroboratedByEditorial: hasEditorialCorroboration,
          corroboratedBySocial: hasSocialCorroboration,
          corroboratedByGooglePlaces: hasGooglePlacesCorroboration,
          candidateOnly: true,
          sourceWeight: 0.22,
        },
      });
    }
  }
  return out;
}
