/**
 * Approximate neighborhood centroids for LA Signal Map fallbacks (not parcel-precise).
 */
export const LA_SIGNAL_MAP_NEIGHBORHOODS: Array<{
  name: string;
  lat: number;
  lng: number;
}> = [
  { name: "Santa Monica", lat: 34.0195, lng: -118.4912 },
  { name: "Venice", lat: 33.985, lng: -118.4695 },
  { name: "Culver City", lat: 34.0211, lng: -118.3965 },
  { name: "West Hollywood", lat: 34.09, lng: -118.3617 },
  { name: "Fairfax", lat: 34.079, lng: -118.361 },
  { name: "Koreatown", lat: 34.058, lng: -118.3 },
  { name: "Thai Town", lat: 34.102, lng: -118.305 },
  { name: "Silver Lake", lat: 34.086, lng: -118.27 },
  { name: "Echo Park", lat: 34.078, lng: -118.2606 },
  { name: "Downtown LA", lat: 34.0407, lng: -118.2468 },
  { name: "Arts District", lat: 34.0417, lng: -118.2325 },
  { name: "Boyle Heights", lat: 34.0339, lng: -118.2053 },
  { name: "Highland Park", lat: 34.1157, lng: -118.1926 },
  { name: "Pasadena", lat: 34.1478, lng: -118.1445 },
  { name: "Inglewood", lat: 33.9617, lng: -118.3531 },
  { name: "Long Beach", lat: 33.7701, lng: -118.1937 },
];

/** ~2.2 km grid for bucketing restaurant coordinates (degrees). */
export const LA_PLACE_CLUSTER_CELL_DEG = 0.02;

export type LaSignalMapNeighborhood = {
  name: string;
  lat: number;
  lng: number;
  count: number;
  strongestCategory: string;
  topTrend: string;
  activity: "green" | "yellow" | "red";
  coordinateType: string;
  placeCount: number;
  sourceMix: string;
};

export type LaSignalMapPlaceCluster = {
  key: string;
  lat: number;
  lng: number;
  count: number;
  strongestCuisine: string;
  anchor: {
    name: string;
    neighborhood?: string | null;
    source?: string;
    cuisines?: string[];
    rating?: number | null;
  };
};

export type LaSignalMapPlacePoint = {
  lat: number;
  lng: number;
  name: string;
  neighborhood?: string | null;
  source?: string;
  cuisines?: string[];
  rating?: number | null;
};
