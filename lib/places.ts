export type PlacesSearchHit = {
  displayName: string;
  formattedAddress: string;
  rating: number | null;
  userRatingCount: number | null;
  types: string[];
};

const SEARCH_TEXT_URL = "https://places.googleapis.com/v1/places:searchText";

type GooglePlaceRaw = {
  displayName?: { text?: string };
  formattedAddress?: string;
  rating?: number;
  userRatingCount?: number;
  types?: string[];
};

type GoogleSearchTextResponse = {
  places?: GooglePlaceRaw[];
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

/**
 * Google Places API (New) Text Search for the LA metro bias circle.
 */
export async function searchPlaces(query: string): Promise<PlacesSearchHit[]> {
  const apiKey = requireGooglePlacesApiKey();

  const res = await fetch(SEARCH_TEXT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.types",
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

  if (!res.ok) {
    await res.text();
    throw new Error(`Google Places searchText failed (${res.status})`);
  }

  const json = (await res.json()) as GoogleSearchTextResponse;
  const places = json.places ?? [];

  return places.map((p) => ({
    displayName: typeof p.displayName?.text === "string" ? p.displayName.text : "",
    formattedAddress:
      typeof p.formattedAddress === "string" ? p.formattedAddress : "",
    rating: typeof p.rating === "number" && Number.isFinite(p.rating) ? p.rating : null,
    userRatingCount:
      typeof p.userRatingCount === "number" && Number.isFinite(p.userRatingCount)
        ? p.userRatingCount
        : null,
    types: Array.isArray(p.types)
      ? p.types.filter((t): t is string => typeof t === "string")
      : [],
  }));
}
