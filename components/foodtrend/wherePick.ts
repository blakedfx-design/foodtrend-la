export type WherePick = {
  restaurant: string;
  neighborhood: string;
  dish: string;
  url?: string;
  yelp_url?: string;
  source_url?: string;
  /** Alternate disk/API key for outbound URLs */
  link?: string;
  source?: string;
  rating?: number;
  review_count?: number;
};

/** Minimal shape for URL resolution (trend JSON rows + picks). */
export type RestaurantLinkSource = Partial<
  Pick<WherePick, "url" | "yelp_url" | "source_url" | "link">
>;

/** First HTTPS URL among url → yelp → source → link. */
export function getRestaurantUrl(restaurant: RestaurantLinkSource): string | null {
  const candidates = [
    restaurant.url,
    restaurant.yelp_url,
    restaurant.source_url,
    restaurant.link,
  ];
  for (const raw of candidates) {
    if (typeof raw !== "string") {
      continue;
    }
    const u = raw.trim();
    if (/^https?:\/\//i.test(u)) {
      return u;
    }
  }
  return null;
}

export function restaurantOutboundHref(pick: WherePick): string | null {
  return getRestaurantUrl(pick);
}
