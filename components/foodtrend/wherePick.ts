export type WherePick = {
  restaurant: string;
  neighborhood: string;
  dish: string;
  instagramUrl?: string;
  tiktokUrl?: string;
  websiteUrl?: string;
  googleMapsUrl?: string;
  fallbackUrl?: string;
  /** Legacy ingest / migration */
  source_url?: string;
  link?: string;
  source?: string;
  rating?: number;
  review_count?: number;
};

/** Shape used to resolve outbound href for a venue row or pick. */
export type RestaurantLinkSource = Partial<
  Pick<
    WherePick,
    | "instagramUrl"
    | "tiktokUrl"
    | "websiteUrl"
    | "googleMapsUrl"
    | "fallbackUrl"
    | "source_url"
    | "link"
  >
>;

export type RestaurantSocialBadge = "instagram" | "tiktok" | null;

export type RestaurantLinkResolution = {
  url: string;
  badge: RestaurantSocialBadge;
};

export function isLikelyGoogleMapsUrl(u: string): boolean {
  return /google\.com\/maps|goo\.gl\/maps|maps\.apple\.com/i.test(u);
}

function trimHttp(raw: string | undefined): string | null {
  if (typeof raw !== "string") {
    return null;
  }
  const u = raw.trim();
  if (!/^https?:\/\//i.test(u)) {
    return null;
  }
  return u;
}

/**
 * Social-first outbound URL for venue names: Instagram → TikTok → website → Maps → fallback,
 * then legacy `source_url` / `link`.
 */
export function resolveRestaurantLink(
  restaurant: RestaurantLinkSource,
): RestaurantLinkResolution | null {
  const ig = trimHttp(restaurant.instagramUrl);
  if (ig) {
    return { url: ig, badge: "instagram" };
  }
  const tt = trimHttp(restaurant.tiktokUrl);
  if (tt) {
    return { url: tt, badge: "tiktok" };
  }
  const web = trimHttp(restaurant.websiteUrl);
  if (web) {
    return { url: web, badge: null };
  }
  const gmExplicit = trimHttp(restaurant.googleMapsUrl);
  const fb = trimHttp(restaurant.fallbackUrl);
  const gm = gmExplicit ?? (fb && isLikelyGoogleMapsUrl(fb) ? fb : null);
  if (gm) {
    return { url: gm, badge: null };
  }
  if (fb) {
    return { url: fb, badge: null };
  }
  const su = trimHttp(restaurant.source_url);
  if (su) {
    return { url: su, badge: null };
  }
  const lk = trimHttp(restaurant.link);
  if (lk) {
    return { url: lk, badge: null };
  }
  return null;
}

export function getRestaurantUrl(restaurant: RestaurantLinkSource): string | null {
  return resolveRestaurantLink(restaurant)?.url ?? null;
}

/** True when a usable HTTPS `instagramUrl` is present (controls ↗ on venue name links). */
export function pickHasInstagramLink(source: RestaurantLinkSource): boolean {
  const ig = trimHttp(source.instagramUrl);
  return ig != null && /^https?:\/\/(www\.)?instagram\.com\//i.test(ig);
}

export function restaurantOutboundHref(pick: WherePick): string | null {
  return getRestaurantUrl(pick);
}
