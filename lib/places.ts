export type PlacesSearchHit = {
  displayName: string;
  formattedAddress: string;
  rating: number | null;
  userRatingCount: number | null;
  types: string[];
};

export type NormalizedPlace = {
  restaurantName: string;
  placeId: string;
  coordinates: { lat: number; lng: number } | null;
  neighborhood: string | null;
  cuisines: string[];
  types: string[];
  rating: number | null;
  reviewCount: number | null;
  priceLevel: string | null;
  formattedAddress: string;
};

export type PlacesRequestDiagnostic = {
  ok: boolean;
  statusCode: number | null;
  requestStatus: "ok" | "auth_error" | "quota_error" | "restricted_key" | "api_disabled" | "invalid_request" | "network_error" | "unknown_error";
  errorMessage: string | null;
  actionableMessage: string | null;
};

export type PlacesSearchResult = {
  places: NormalizedPlace[];
  diagnostic: PlacesRequestDiagnostic;
};

export type GeocodeResult = {
  formattedAddress: string;
  coordinates: { lat: number; lng: number } | null;
  diagnostic: PlacesRequestDiagnostic;
};

const SEARCH_TEXT_URL = "https://places.googleapis.com/v1/places:searchText";
const GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json";

type GooglePlaceRaw = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  rating?: number;
  userRatingCount?: number;
  types?: string[];
  location?: { latitude?: number; longitude?: number };
  priceLevel?: string;
};

type GoogleSearchTextResponse = {
  places?: GooglePlaceRaw[];
  error?: { message?: string; status?: string };
};

type GoogleGeocodeResponse = {
  status?: string;
  error_message?: string;
  results?: Array<{
    formatted_address?: string;
    geometry?: { location?: { lat?: number; lng?: number } };
  }>;
};

export function requireGooglePlacesApiKey(): string {
  const key = process.env.GOOGLE_PLACES_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "GOOGLE_PLACES_API_KEY is missing. Set it in the environment to enable Places search.",
    );
  }
  return key;
}

function classifyPlacesError(statusCode: number | null, statusText: string): PlacesRequestDiagnostic {
  const lower = statusText.toLowerCase();
  if (
    statusCode === 401 ||
    lower.includes("invalid api key") ||
    lower.includes("api key not valid") ||
    lower.includes("api_key_invalid")
  ) {
    return {
      ok: false,
      statusCode,
      requestStatus: "auth_error",
      errorMessage: statusText,
      actionableMessage: "Google Places auth failed. Verify GOOGLE_PLACES_API_KEY is valid and active.",
    };
  }
  if (statusCode === 403 && (lower.includes("referer") || lower.includes("ip") || lower.includes("restricted"))) {
    return {
      ok: false,
      statusCode,
      requestStatus: "restricted_key",
      errorMessage: statusText,
      actionableMessage: "API key appears restricted for this server-side request. Allow server IP or remove browser-only referrer restriction.",
    };
  }
  if (statusCode === 403 && (lower.includes("disabled") || lower.includes("not enabled"))) {
    return {
      ok: false,
      statusCode,
      requestStatus: "api_disabled",
      errorMessage: statusText,
      actionableMessage: "Google API appears disabled for this project. Enable Places API (New) and Geocoding API.",
    };
  }
  if (statusCode === 429 || lower.includes("quota")) {
    return {
      ok: false,
      statusCode,
      requestStatus: "quota_error",
      errorMessage: statusText,
      actionableMessage: "Quota exceeded. Raise Places API quota or reduce request volume.",
    };
  }
  if (statusCode === 400 || lower.includes("invalid argument")) {
    return {
      ok: false,
      statusCode,
      requestStatus: "invalid_request",
      errorMessage: statusText,
      actionableMessage: "Invalid Places request format. Verify endpoint, field mask, and request body.",
    };
  }
  return {
    ok: false,
    statusCode,
    requestStatus: statusCode == null ? "network_error" : "unknown_error",
    errorMessage: statusText || null,
    actionableMessage:
      statusCode == null
        ? "Network error while calling Google Places. Check outbound connectivity and DNS."
        : "Google Places request failed. Inspect response status/message for restrictions or API config issues.",
  };
}

function neighborhoodFromAddress(address: string): string | null {
  if (!address) return null;
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  return parts[parts.length - 4] || parts[parts.length - 3] || parts[0] || null;
}

function normalizePlace(raw: GooglePlaceRaw): NormalizedPlace | null {
  const restaurantName = typeof raw.displayName?.text === "string" ? raw.displayName.text.trim() : "";
  const placeId = typeof raw.id === "string" ? raw.id.trim() : "";
  const formattedAddress =
    typeof raw.formattedAddress === "string" ? raw.formattedAddress.trim() : "";
  if (!restaurantName || !placeId) return null;
  const types = Array.isArray(raw.types)
    ? raw.types.filter((t): t is string => typeof t === "string")
    : [];
  const cuisines = types
    .filter((t) => t.endsWith("_restaurant"))
    .map((t) => t.replace(/_restaurant$/, "").replaceAll("_", " ").trim())
    .filter(Boolean);
  const lat = raw.location?.latitude;
  const lng = raw.location?.longitude;
  return {
    restaurantName,
    placeId,
    coordinates:
      typeof lat === "number" && Number.isFinite(lat) && typeof lng === "number" && Number.isFinite(lng)
        ? { lat, lng }
        : null,
    neighborhood: neighborhoodFromAddress(formattedAddress),
    cuisines,
    types,
    rating: typeof raw.rating === "number" && Number.isFinite(raw.rating) ? raw.rating : null,
    reviewCount:
      typeof raw.userRatingCount === "number" && Number.isFinite(raw.userRatingCount)
        ? raw.userRatingCount
        : null,
    priceLevel: typeof raw.priceLevel === "string" ? raw.priceLevel : null,
    formattedAddress,
  };
}

export function googlePlacesEnabled(): boolean {
  return Boolean(process.env.GOOGLE_PLACES_API_KEY?.trim());
}

export async function searchPlacesDetailed(query: string): Promise<PlacesSearchResult> {
  const apiKey = requireGooglePlacesApiKey();
  try {
    const res = await fetch(SEARCH_TEXT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.types,places.location,places.priceLevel",
      },
      body: JSON.stringify({
        textQuery: query,
        locationBias: {
          circle: {
            center: { latitude: 34.0522, longitude: -118.2437 },
            radius: 25000,
          },
        },
      }),
    });
    const bodyText = await res.text();
    let json: GoogleSearchTextResponse = {};
    try {
      json = JSON.parse(bodyText) as GoogleSearchTextResponse;
    } catch {
      json = {};
    }
    if (!res.ok) {
      return {
        places: [],
        diagnostic: classifyPlacesError(
          res.status,
          json.error?.message ?? json.error?.status ?? bodyText.slice(0, 180),
        ),
      };
    }
    const places = (json.places ?? [])
      .map(normalizePlace)
      .filter((p): p is NormalizedPlace => p != null);
    return {
      places,
      diagnostic: {
        ok: true,
        statusCode: res.status,
        requestStatus: "ok",
        errorMessage: null,
        actionableMessage: null,
      },
    };
  } catch (e) {
    return {
      places: [],
      diagnostic: classifyPlacesError(null, e instanceof Error ? e.message : String(e)),
    };
  }
}

export async function geocodeAddress(address: string): Promise<GeocodeResult> {
  const apiKey = requireGooglePlacesApiKey();
  try {
    const params = new URLSearchParams({ address, key: apiKey });
    const res = await fetch(`${GEOCODE_URL}?${params.toString()}`, { cache: "no-store" });
    const text = await res.text();
    let json: GoogleGeocodeResponse = {};
    try {
      json = JSON.parse(text) as GoogleGeocodeResponse;
    } catch {
      json = {};
    }
    if (!res.ok || json.status !== "OK") {
      const errorText = json.error_message || json.status || text.slice(0, 180);
      return {
        formattedAddress: "",
        coordinates: null,
        diagnostic: classifyPlacesError(res.status, errorText),
      };
    }
    const first = json.results?.[0];
    const lat = first?.geometry?.location?.lat;
    const lng = first?.geometry?.location?.lng;
    return {
      formattedAddress: typeof first?.formatted_address === "string" ? first.formatted_address : "",
      coordinates:
        typeof lat === "number" && Number.isFinite(lat) && typeof lng === "number" && Number.isFinite(lng)
          ? { lat, lng }
          : null,
      diagnostic: {
        ok: true,
        statusCode: res.status,
        requestStatus: "ok",
        errorMessage: null,
        actionableMessage: null,
      },
    };
  } catch (e) {
    return {
      formattedAddress: "",
      coordinates: null,
      diagnostic: classifyPlacesError(null, e instanceof Error ? e.message : String(e)),
    };
  }
}

/**
 * Backward-compatible wrapper for existing callers.
 */
export async function searchPlaces(query: string): Promise<PlacesSearchHit[]> {
  const result = await searchPlacesDetailed(query);
  if (!result.diagnostic.ok) {
    throw new Error(
      result.diagnostic.errorMessage
        ? `Google Places searchText failed: ${result.diagnostic.errorMessage}`
        : "Google Places searchText failed",
    );
  }
  return result.places.map((p) => ({
    displayName: p.restaurantName,
    formattedAddress: p.formattedAddress,
    rating: p.rating,
    userRatingCount: p.reviewCount,
    types: p.types,
  }));
}
