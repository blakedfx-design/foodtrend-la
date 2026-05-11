import type { Trend } from "@/types/laFoodTrend";

const EDITORIAL_FOOD_PATH_PREFIX = "/editorial/food/";

const DISALLOWED_HERO_IMAGE_SUBSTRINGS = [
  "screencapture",
  "screenshot",
  "mockup",
  "reference",
  "localhost",
] as const;

const EDITORIAL_FOOD_FILENAME = /^[\w.-]+\.(avif|gif|jpe?g|png|webp)$/i;

function isDisallowedHeroImagePath(pathLower: string): boolean {
  return DISALLOWED_HERO_IMAGE_SUBSTRINGS.some((frag) => pathLower.includes(frag));
}

/**
 * Only curated files in `public/editorial/food/` — no remote URLs, no path traversal.
 * Shared by homepage cards and editorial prop mapping.
 */
export function resolveEditorialFoodHeroSrc(raw?: string | null): string | undefined {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return undefined;
  }
  const pathOnly = trimmed.split("?")[0].split("#")[0];
  const lower = pathOnly.toLowerCase();
  if (
    isDisallowedHeroImagePath(lower) ||
    lower.includes("..") ||
    lower.includes("//") ||
    pathOnly.includes(":") ||
    !pathOnly.startsWith(EDITORIAL_FOOD_PATH_PREFIX)
  ) {
    return undefined;
  }
  const file = pathOnly.slice(EDITORIAL_FOOD_PATH_PREFIX.length);
  if (!file || file.includes("/") || !EDITORIAL_FOOD_FILENAME.test(file)) {
    return undefined;
  }
  return pathOnly;
}

type CuratedFallback = {
  heroImageUrl: string;
  heroImageSource?: string;
  heroImageSourceUrl?: string;
  heroImageCredit?: string;
};

/**
 * When JSON omits hero fields but a curated file already exists in `public/editorial/food/`,
 * map trend id → default hero (real venue/context — not generic stock).
 */
const CURATED_HERO_FALLBACK_BY_TREND_ID: Record<string, CuratedFallback> = {
  "hainan-chicken-lunch": {
    heroImageUrl: "/editorial/food/savoy-kitchen-hainan.png",
    heroImageSource: "Savoy Kitchen",
    heroImageCredit: "Photo for editorial use",
  },
  "aguachile-ice": {
    heroImageUrl: "/editorial/food/aguachile-holbox.jpg",
    heroImageSource: "Holbox",
    heroImageCredit: "Photo for editorial use",
  },
  "natural-wine-martini-hour": {
    heroImageUrl: "/editorial/food/bar-bandini-interior.png",
    heroImageSource: "Bar Bandini",
    heroImageCredit: "Photo for editorial use",
  },
};

export type EditorialHeroProps = {
  heroImageUrl?: string;
  heroImageSource?: string;
  heroImageSourceUrl?: string;
  heroImageCredit?: string;
};

/**
 * Resolve hero image for public trend cards: explicit trend hero → venue hero paths → id fallbacks.
 */
export function editorialHeroPropsForTrend(trend: Trend): EditorialHeroProps {
  const fromTrend = resolveEditorialFoodHeroSrc(trend.heroImageUrl);
  if (fromTrend) {
    return {
      heroImageUrl: fromTrend,
      ...(trend.heroImageSource ? { heroImageSource: trend.heroImageSource } : {}),
      ...(trend.heroImageSourceUrl ? { heroImageSourceUrl: trend.heroImageSourceUrl } : {}),
      ...(trend.heroImageCredit ? { heroImageCredit: trend.heroImageCredit } : {}),
    };
  }

  for (const r of trend.restaurants) {
    const fromVenue = resolveEditorialFoodHeroSrc(r.heroImageUrl);
    if (fromVenue) {
      return {
        heroImageUrl: fromVenue,
        heroImageSource: r.name,
        ...(r.instagramUrl || r.websiteUrl
          ? { heroImageSourceUrl: r.instagramUrl ?? r.websiteUrl }
          : {}),
      };
    }
  }

  const fallback = CURATED_HERO_FALLBACK_BY_TREND_ID[trend.id];
  if (fallback) {
    return {
      heroImageUrl: fallback.heroImageUrl,
      ...(fallback.heroImageSource ? { heroImageSource: fallback.heroImageSource } : {}),
      ...(fallback.heroImageSourceUrl ? { heroImageSourceUrl: fallback.heroImageSourceUrl } : {}),
      ...(fallback.heroImageCredit ? { heroImageCredit: fallback.heroImageCredit } : {}),
    };
  }

  return {};
}
