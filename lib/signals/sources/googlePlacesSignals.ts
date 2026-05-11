import {
  geocodeAddress,
  googlePlacesEnabled,
  searchPlacesDetailed,
  type NormalizedPlace,
  type PlacesRequestDiagnostic,
} from "@/lib/places";
import type { TrendSignal } from "@/lib/signals/types";

export type GooglePlacesConnectorDiagnostics = {
  googlePlacesEnabled: boolean;
  runtimeTarget: "production" | "preview" | "development";
  localWarning: string | null;
  requestStatus: PlacesRequestDiagnostic["requestStatus"];
  requestStatusCode: number | null;
  requestErrorMessage: string | null;
  actionableMessage: string | null;
  authError: boolean;
  quotaError: boolean;
  restrictedKeyError: boolean;
  apiDisabledError: boolean;
  invalidRequestError: boolean;
  zeroResults: boolean;
  placesFetched: number;
  normalizedPlaceCount: number;
  geoPointsMapped: number;
  cuisineEntitiesExtracted: number;
  trendCandidatesGenerated: number;
  candidateSignalCount: number;
  finalSignalCount: number;
  connectivityTest: {
    query: string;
    ok: boolean;
    placeIdPresent: boolean;
    coordinatesPresent: boolean;
    typesPresent: boolean;
    ratingPresent: boolean;
    reviewCountPresent: boolean;
    sample: NormalizedPlace | null;
  };
  geocoding: {
    query: string;
    ok: boolean;
    formattedAddress: string | null;
    coordinates: { lat: number; lng: number } | null;
    requestStatus: PlacesRequestDiagnostic["requestStatus"];
  };
  normalizedPlaces: NormalizedPlace[];
};

const GOOGLE_TREND_QUERIES = [
  "Sonoratown Los Angeles",
  "best tacos Los Angeles",
  "new restaurants Los Angeles",
  "hainan chicken Los Angeles",
  "natural wine bars Los Angeles",
  "bakery cafe Los Angeles",
] as const;

const TYPE_TO_CUISINE: Record<string, string> = {
  mexican_restaurant: "mexican",
  korean_restaurant: "korean",
  thai_restaurant: "thai",
  japanese_restaurant: "japanese",
  italian_restaurant: "italian",
  chinese_restaurant: "chinese",
  vietnamese_restaurant: "vietnamese",
  filipino_restaurant: "filipino",
  mediterranean_restaurant: "mediterranean",
};

const GENERIC_ENTITY_TERMS = new Set(["restaurant", "food", "establishment", "meal_takeaway", "point_of_interest"]);

type GoogleCandidate = {
  entityType: "dish" | "cuisine" | "restaurant";
  entity: string;
  supportingPlaceIds: string[];
  neighborhoods: string[];
  confidence: number;
  velocity: number;
  matchReason: string;
};

let lastGooglePlacesDiagnostics: GooglePlacesConnectorDiagnostics = {
  googlePlacesEnabled: false,
  runtimeTarget: "development",
  localWarning: "Google Places disabled locally: missing GOOGLE_PLACES_API_KEY",
  requestStatus: "invalid_request",
  requestStatusCode: null,
  requestErrorMessage: "GOOGLE_PLACES_API_KEY missing",
  actionableMessage: "Set GOOGLE_PLACES_API_KEY in .env.local for local development.",
  authError: false,
  quotaError: false,
  restrictedKeyError: false,
  apiDisabledError: false,
  invalidRequestError: true,
  zeroResults: true,
  placesFetched: 0,
  normalizedPlaceCount: 0,
  geoPointsMapped: 0,
  cuisineEntitiesExtracted: 0,
  trendCandidatesGenerated: 0,
  candidateSignalCount: 0,
  finalSignalCount: 0,
  connectivityTest: {
    query: "Sonoratown Los Angeles",
    ok: false,
    placeIdPresent: false,
    coordinatesPresent: false,
    typesPresent: false,
    ratingPresent: false,
    reviewCountPresent: false,
    sample: null,
  },
  geocoding: {
    query: "Koreatown Los Angeles",
    ok: false,
    formattedAddress: null,
    coordinates: null,
    requestStatus: "invalid_request",
  },
  normalizedPlaces: [],
};

function runtimeTarget(): "production" | "preview" | "development" {
  const vercelEnv = process.env.VERCEL_ENV;
  if (vercelEnv === "production") return "production";
  if (vercelEnv === "preview") return "preview";
  return "development";
}

function localMissingWarning(enabled: boolean): string | null {
  if (runtimeTarget() !== "development" || enabled) return null;
  return "Google Places disabled locally: missing GOOGLE_PLACES_API_KEY";
}

function compactNeighborhood(place: NormalizedPlace): string {
  const raw = (place.neighborhood || "").trim();
  if (!raw) return "unknown";
  return raw.toLowerCase();
}

function clampConfidence(value: number): number {
  return Math.max(0.2, Math.min(0.68, value));
}

function entityLooksGeneric(entity: string): boolean {
  const normalized = entity.trim().toLowerCase();
  return !normalized || GENERIC_ENTITY_TERMS.has(normalized);
}

function addCandidate(
  acc: Map<string, GoogleCandidate>,
  candidate: Omit<GoogleCandidate, "supportingPlaceIds" | "neighborhoods"> & {
    supportingPlaceId: string;
    neighborhood: string;
  },
) {
  if (entityLooksGeneric(candidate.entity)) return;
  const key = `${candidate.entityType}:${candidate.entity.toLowerCase()}`;
  const current = acc.get(key);
  if (!current) {
    acc.set(key, {
      entityType: candidate.entityType,
      entity: candidate.entity,
      supportingPlaceIds: [candidate.supportingPlaceId],
      neighborhoods: [candidate.neighborhood],
      confidence: candidate.confidence,
      velocity: candidate.velocity,
      matchReason: candidate.matchReason,
    });
    return;
  }
  if (!current.supportingPlaceIds.includes(candidate.supportingPlaceId)) {
    current.supportingPlaceIds.push(candidate.supportingPlaceId);
  }
  if (!current.neighborhoods.includes(candidate.neighborhood)) {
    current.neighborhoods.push(candidate.neighborhood);
  }
  current.confidence = Math.max(current.confidence, candidate.confidence);
  current.velocity = Math.max(current.velocity, candidate.velocity);
}

function extractGoogleCandidates(
  places: NormalizedPlace[],
  corroboratedEntities: Set<string>,
): GoogleCandidate[] {
  const map = new Map<string, GoogleCandidate>();
  const cuisineCounts = new Map<string, { places: Set<string>; neighborhoods: Set<string>; reviewVelocity: number }>();

  for (const place of places) {
    const neighborhood = compactNeighborhood(place);
    const nameLower = place.restaurantName.toLowerCase();
    const reviewVelocity = Math.min(1, (place.reviewCount ?? 0) / 1200) + (place.rating ?? 0) / 10;

    for (const type of place.types) {
      const cuisine = TYPE_TO_CUISINE[type];
      if (!cuisine) continue;
      const stat = cuisineCounts.get(cuisine) ?? { places: new Set<string>(), neighborhoods: new Set<string>(), reviewVelocity: 0 };
      stat.places.add(place.placeId);
      stat.neighborhoods.add(neighborhood);
      stat.reviewVelocity += reviewVelocity;
      cuisineCounts.set(cuisine, stat);
    }

    if (/sonoran|sonoratown/.test(nameLower)) {
      addCandidate(map, {
        entityType: "dish",
        entity: "sonoran tacos",
        supportingPlaceId: place.placeId,
        neighborhood,
        confidence: 0.42,
        velocity: 0.58,
        matchReason: "name_pattern_sonoran_tacos",
      });
    }
    if (/hainan/.test(nameLower) && /chicken/.test(nameLower)) {
      addCandidate(map, {
        entityType: "dish",
        entity: "hainan chicken",
        supportingPlaceId: place.placeId,
        neighborhood,
        confidence: 0.4,
        velocity: 0.52,
        matchReason: "name_pattern_hainan_chicken",
      });
    }
    if (/korean/.test(nameLower) && /snack\\s*bar/.test(nameLower)) {
      addCandidate(map, {
        entityType: "restaurant",
        entity: "korean snack bars",
        supportingPlaceId: place.placeId,
        neighborhood,
        confidence: 0.37,
        velocity: 0.49,
        matchReason: "name_pattern_korean_snack_bar",
      });
    }
    if (/bakery/.test(nameLower) && /cafe/.test(nameLower)) {
      addCandidate(map, {
        entityType: "restaurant",
        entity: "bakery cafes",
        supportingPlaceId: place.placeId,
        neighborhood,
        confidence: 0.35,
        velocity: 0.46,
        matchReason: "name_pattern_bakery_cafe",
      });
    }
    if (/natural\\s*wine|wine\\s*bar/.test(nameLower)) {
      addCandidate(map, {
        entityType: "restaurant",
        entity: "natural wine bars",
        supportingPlaceId: place.placeId,
        neighborhood,
        confidence: 0.39,
        velocity: 0.5,
        matchReason: "name_pattern_natural_wine",
      });
    }

    addCandidate(map, {
      entityType: "restaurant",
      entity: place.restaurantName,
      supportingPlaceId: place.placeId,
      neighborhood,
      confidence: 0.29,
      velocity: Math.min(0.7, 0.33 + reviewVelocity * 0.15),
      matchReason: "place_name_observation",
    });
  }

  for (const [cuisine, stat] of cuisineCounts.entries()) {
    const occurrenceCount = stat.places.size;
    const neighborhoodCount = stat.neighborhoods.size;
    if (occurrenceCount < 2) continue;
    const corroborated = corroboratedEntities.has(cuisine);
    const confidence = clampConfidence(
      0.34 +
        (occurrenceCount >= 3 ? 0.06 : 0) +
        (neighborhoodCount >= 2 ? 0.08 : 0) +
        (stat.reviewVelocity > 1.8 ? 0.05 : 0) +
        (corroborated ? 0.1 : 0),
    );
    const velocity = Math.min(0.88, 0.45 + occurrenceCount * 0.06 + neighborhoodCount * 0.05);
    addCandidate(map, {
      entityType: "cuisine",
      entity: cuisine,
      supportingPlaceId: [...stat.places][0],
      neighborhood: [...stat.neighborhoods][0] ?? "unknown",
      confidence,
      velocity,
      matchReason: "repeated_cuisine_concentration",
    });
  }

  const candidates = [...map.values()];
  for (const candidate of candidates) {
    const neighborhoodSpreadBoost = candidate.neighborhoods.length >= 2 ? 0.05 : 0;
    const repeatedBoost = candidate.supportingPlaceIds.length >= 2 ? 0.04 : 0;
    const corroboratedBoost = corroboratedEntities.has(candidate.entity.toLowerCase()) ? 0.1 : 0;
    candidate.confidence = clampConfidence(
      candidate.confidence + neighborhoodSpreadBoost + repeatedBoost + corroboratedBoost,
    );
  }
  return candidates;
}

function trendSignalsFromPlaces(
  places: NormalizedPlace[],
  nowIso: string,
  corroboratedEntities: Set<string>,
): TrendSignal[] {
  const candidates = extractGoogleCandidates(places, corroboratedEntities);
  const placeById = new Map(places.map((place) => [place.placeId, place]));
  return candidates.map((candidate, idx) => {
    const exemplar = placeById.get(candidate.supportingPlaceIds[0]);
    const neighborhoods = [...candidate.neighborhoods.filter((n) => n !== "unknown")];
    return {
      id: `google_places:candidate:${idx}:${candidate.entity.toLowerCase().replace(/\s+/g, "-")}`,
      source: "google_places",
      entityType: candidate.entityType,
      entity: candidate.entity,
      confidence: candidate.confidence,
      velocity: candidate.velocity,
      timestamp: nowIso,
      metadata: {
        candidateOnly: true,
        sourceWeight: 0.24,
        matchReason: candidate.matchReason,
        supportingPlaceCount: candidate.supportingPlaceIds.length,
        neighborhoodSpread: neighborhoods.length,
        corroboratedByEditorial: corroboratedEntities.has(candidate.entity.toLowerCase()),
        neighborhoods,
        placeId: exemplar?.placeId ?? null,
        placeCoordinates: exemplar?.coordinates ?? null,
        placeNeighborhood: exemplar?.neighborhood ?? null,
        placeTypes: exemplar?.types ?? [],
        placeRating: exemplar?.rating ?? null,
        placeReviewCount: exemplar?.reviewCount ?? null,
        placePriceLevel: exemplar?.priceLevel ?? null,
        restaurant: exemplar?.restaurantName ?? null,
      },
    };
  });
}

export function getGooglePlacesDiagnostics(): GooglePlacesConnectorDiagnostics {
  return lastGooglePlacesDiagnostics;
}

export async function getGooglePlacesSignals(opts?: {
  corroboratedEntities?: string[];
}): Promise<TrendSignal[]> {
  const enabled = googlePlacesEnabled();
  const target = runtimeTarget();
  const localWarning = localMissingWarning(enabled);
  if (!enabled) {
    lastGooglePlacesDiagnostics = {
      ...lastGooglePlacesDiagnostics,
      googlePlacesEnabled: false,
      runtimeTarget: target,
      localWarning,
      requestStatus: "invalid_request",
      requestStatusCode: null,
      requestErrorMessage: "GOOGLE_PLACES_API_KEY missing",
      actionableMessage:
        target === "development"
          ? "Set GOOGLE_PLACES_API_KEY in .env.local for local development."
          : "Set GOOGLE_PLACES_API_KEY in runtime environment.",
      authError: false,
      quotaError: false,
      restrictedKeyError: false,
      apiDisabledError: false,
      invalidRequestError: true,
      zeroResults: true,
      placesFetched: 0,
      normalizedPlaceCount: 0,
      geoPointsMapped: 0,
      cuisineEntitiesExtracted: 0,
      trendCandidatesGenerated: 0,
      candidateSignalCount: 0,
      finalSignalCount: 0,
      normalizedPlaces: [],
    };
    return [];
  }

  const first = await searchPlacesDetailed(GOOGLE_TREND_QUERIES[0]);
  let allPlaces = [...first.places];
  let primaryDiagnostic = first.diagnostic;
  if (first.diagnostic.ok) {
    for (const query of GOOGLE_TREND_QUERIES.slice(1)) {
      const next = await searchPlacesDetailed(query);
      if (!next.diagnostic.ok && primaryDiagnostic.ok) primaryDiagnostic = next.diagnostic;
      allPlaces = [...allPlaces, ...next.places];
    }
  }
  const byPlaceId = new Map<string, NormalizedPlace>();
  for (const place of allPlaces) byPlaceId.set(place.placeId, place);
  const normalizedPlaces = [...byPlaceId.values()];
  const geocoding = await geocodeAddress("Koreatown Los Angeles");
  const nowIso = new Date().toISOString();
  const corroboratedEntities = new Set(
    (opts?.corroboratedEntities ?? []).map((name) => name.trim().toLowerCase()).filter(Boolean),
  );
  const signals = trendSignalsFromPlaces(normalizedPlaces, nowIso, corroboratedEntities);
  const geoPointsMapped = normalizedPlaces.filter((place) => place.coordinates != null).length;
  const cuisineEntitiesExtracted = signals.filter((signal) => signal.entityType === "cuisine").length;
  const trendCandidatesGenerated = signals.length;
  const connectivitySample = normalizedPlaces[0] ?? null;

  lastGooglePlacesDiagnostics = {
    googlePlacesEnabled: true,
    runtimeTarget: target,
    localWarning,
    requestStatus: primaryDiagnostic.requestStatus,
    requestStatusCode: primaryDiagnostic.statusCode,
    requestErrorMessage: primaryDiagnostic.errorMessage,
    actionableMessage: primaryDiagnostic.actionableMessage,
    authError: primaryDiagnostic.requestStatus === "auth_error",
    quotaError: primaryDiagnostic.requestStatus === "quota_error",
    restrictedKeyError: primaryDiagnostic.requestStatus === "restricted_key",
    apiDisabledError: primaryDiagnostic.requestStatus === "api_disabled",
    invalidRequestError: primaryDiagnostic.requestStatus === "invalid_request",
    zeroResults: normalizedPlaces.length === 0,
    placesFetched: allPlaces.length,
    normalizedPlaceCount: normalizedPlaces.length,
    geoPointsMapped,
    cuisineEntitiesExtracted,
    trendCandidatesGenerated,
    candidateSignalCount: signals.length,
    finalSignalCount: signals.length,
    connectivityTest: {
      query: GOOGLE_TREND_QUERIES[0],
      ok: first.diagnostic.ok,
      placeIdPresent: Boolean(connectivitySample?.placeId),
      coordinatesPresent: Boolean(connectivitySample?.coordinates),
      typesPresent: (connectivitySample?.types.length ?? 0) > 0,
      ratingPresent: connectivitySample?.rating != null,
      reviewCountPresent: connectivitySample?.reviewCount != null,
      sample: connectivitySample,
    },
    geocoding: {
      query: "Koreatown Los Angeles",
      ok: geocoding.diagnostic.ok && Boolean(geocoding.coordinates),
      formattedAddress: geocoding.formattedAddress || null,
      coordinates: geocoding.coordinates,
      requestStatus: geocoding.diagnostic.requestStatus,
    },
    normalizedPlaces: normalizedPlaces.slice(0, 12),
  };

  if (!first.diagnostic.ok) return [];
  return signals;
}
