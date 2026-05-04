import type { AboutToHitTrend, DishTrendCandidate, FoodTrendsPayload, RightNowTrend } from "../types/trend";
import {
  DEFAULT_SOURCE,
  MIN_RESTAURANTS_FOR_TREND,
  autoEvidenceFromRestaurants,
  dedupeVenues,
  distinctRestaurantCount,
  evidenceMentionsMultiVenueSpread,
  isDishLedTrendCopy,
  readsLikeVenueReview,
  trendsOverlapAcrossSections,
} from "./validateTrend";

const RIGHT_NOW_COUNT = 5;
const ABOUT_TO_HIT_COUNT = 3;

const RIGHT_NOW_SCORE_MAX = 95;
const RIGHT_NOW_SCORE_MIN = 65;

const ABOUT_SCORE_MAX = 72;
const ABOUT_SCORE_MIN = 42;

type ScoredCandidate = {
  candidate: DishTrendCandidate;
  primaryScore: number;
  emergingAffinity: number;
};

function venueSpreadPoints(count: number): number {
  const c = Math.min(8, Math.max(MIN_RESTAURANTS_FOR_TREND, count));
  return c * 15;
}

function evidenceSpreadPoints(evidence: string): number {
  let p = Math.min(36, Math.floor(evidence.length / 7));
  if (evidenceMentionsMultiVenueSpread(evidence)) {
    p += 28;
  }
  return Math.min(56, p);
}

function earlySignalPoints(blob: string): number {
  const t = blob.toLowerCase();
  const re =
    /\b(early|emerging|quietly|niche|pop-up|popup|first wave|few spots|starting to|pilot|preview|under-the-radar|under the radar)\b/g;
  const hits = t.match(re)?.length ?? 0;
  return Math.min(48, hits * 12);
}

function sourcePoints(urls: string[]): number {
  const nonDefault = urls.filter((u) => u.trim() !== DEFAULT_SOURCE);
  return Math.min(14, nonDefault.length * 7);
}

function nameSpecificityPoints(name: string): number {
  const words = name.trim().split(/\s+/).filter(Boolean).length;
  let p = Math.min(22, Math.max(0, (words - 2) * 6));
  if (/-/.test(name)) {
    p += 8;
  }
  return Math.min(28, p);
}

function computePrimaryScore(c: DishTrendCandidate): number {
  const n = distinctRestaurantCount(c.representative_restaurants);
  let score =
    venueSpreadPoints(n) +
    evidenceSpreadPoints(c.evidence_of_spread) +
    sourcePoints(c.sources) +
    nameSpecificityPoints(c.trend_name) +
    Math.min(24, Math.floor(c.definition.length / 12));

  const early = earlySignalPoints(`${c.evidence_of_spread} ${c.why_hot} ${c.definition}`);
  score -= Math.min(25, Math.floor(early * 0.35));

  return score;
}

function computeEmergingAffinity(c: DishTrendCandidate, primaryScore: number): number {
  const blob = `${c.evidence_of_spread} ${c.why_hot} ${c.definition}`;
  let aff = earlySignalPoints(blob) * 2;
  aff += Math.max(0, 72 - Math.min(72, primaryScore));
  aff += nameSpecificityPoints(c.trend_name) / 2;
  return Math.round(aff * 10) / 10;
}

function sliceVenuesForRightNow(venues: string[]): string[] {
  const d = dedupeVenues(venues);
  return d.slice(0, 6);
}

function sliceVenuesForAbout(venues: string[]): string[] {
  const d = dedupeVenues(venues);
  return d.slice(0, 4);
}

function rightNowScoreForRank(rank: number): number {
  if (rank < 1 || rank > RIGHT_NOW_COUNT) {
    return RIGHT_NOW_SCORE_MIN;
  }
  const step = (RIGHT_NOW_SCORE_MAX - RIGHT_NOW_SCORE_MIN) / (RIGHT_NOW_COUNT - 1 || 1);
  return Math.round(RIGHT_NOW_SCORE_MAX - (rank - 1) * step);
}

function aboutScoreForRank(rank: number): number {
  if (rank < 1 || rank > ABOUT_TO_HIT_COUNT) {
    return ABOUT_SCORE_MIN;
  }
  const step = (ABOUT_SCORE_MAX - ABOUT_SCORE_MIN) / (ABOUT_TO_HIT_COUNT - 1 || 1);
  return Math.round(ABOUT_SCORE_MAX - (rank - 1) * step);
}

function trendStageForRank(rank: number): "Rising" | "Peak" {
  return rank <= 2 ? "Peak" : "Rising";
}

function dedupeCandidatesByOverlap(candidates: DishTrendCandidate[]): DishTrendCandidate[] {
  const scored: ScoredCandidate[] = candidates.map((candidate) => {
    const primaryScore = computePrimaryScore(candidate);
    return {
      candidate,
      primaryScore,
      emergingAffinity: computeEmergingAffinity(candidate, primaryScore),
    };
  });

  scored.sort((a, b) => b.primaryScore - a.primaryScore);

  const out: DishTrendCandidate[] = [];
  for (const { candidate } of scored) {
    if (
      out.some((kept) => trendsOverlapAcrossSections(kept.trend_name, candidate.trend_name))
    ) {
      continue;
    }
    out.push(candidate);
  }
  return out;
}

function candidateToAboutTrend(
  c: DishTrendCandidate,
): Pick<AboutToHitTrend, "trend_name" | "emerging_dish_or_item" | "why_it_could_pop" | "early_places_to_watch" | "watch_signal" | "trend_stage" | "sources"> {
  const venues = sliceVenuesForAbout(c.representative_restaurants);

  let emerging = c.definition.split(/(?<=[.!?])\s+/)[0]?.trim() ?? c.definition.slice(0, 110);
  if (emerging.length < 8) {
    emerging = `${c.trend_name} — early-menu sightings across LA.`;
  }
  if (emerging.length > 120) {
    emerging = emerging.slice(0, 117) + "...";
  }

  let why_it_could_pop = `Signals suggest ${c.trend_name.toLowerCase()} could widen as more kitchens test the format.`;
  if (!isDishLedTrendCopy(why_it_could_pop, 20, 220)) {
    why_it_could_pop =
      "Early signals on menus and social buzz suggest this dish format could scale quickly.";
  }

  let watch_signal =
    earlySignalPoints(`${c.evidence_of_spread} ${c.why_hot}`) >= 12
      ? "Language in coverage points to an early, still-narrow LA footprint worth tracking."
      : "Watch weekend specials and new openings adding this format.";
  if (watch_signal.length > 160) {
    watch_signal = watch_signal.slice(0, 157) + "...";
  }

  return {
    trend_name: c.trend_name,
    emerging_dish_or_item: emerging,
    why_it_could_pop,
    early_places_to_watch: venues,
    watch_signal,
    trend_stage: "Emerging",
    sources: c.sources,
  };
}

function candidateToRightNowTrend(
  c: DishTrendCandidate,
  rank: number,
): RightNowTrend {
  const venues = sliceVenuesForRightNow(c.representative_restaurants);
  let evidence = c.evidence_of_spread;
  if (
    evidence.length < 24 ||
    readsLikeVenueReview(evidence) ||
    (!evidenceMentionsMultiVenueSpread(evidence) &&
      !isDishLedTrendCopy(evidence, 24, 280))
  ) {
    evidence = autoEvidenceFromRestaurants(venues);
  }

  return {
    rank,
    trend_name: c.trend_name,
    definition: c.definition,
    representative_restaurants: venues,
    evidence_of_spread: evidence,
    why_hot: c.why_hot,
    trend_score: rightNowScoreForRank(rank),
    trend_stage: trendStageForRank(rank),
    go_now_recommendation: "",
    sources: c.sources,
  };
}

function aboutOverlapsRightNow(
  a: Pick<AboutToHitTrend, "trend_name" | "emerging_dish_or_item">,
  rightTitles: string[],
): boolean {
  const emergingBit = a.emerging_dish_or_item.split(/[—–-]/)[0]?.trim() ?? "";
  for (const rn of rightTitles) {
    if (trendsOverlapAcrossSections(a.trend_name, rn)) {
      return true;
    }
    if (emergingBit && trendsOverlapAcrossSections(emergingBit, rn)) {
      return true;
    }
  }
  return false;
}

/** Validation-stage dedupe: keep stronger-scoring candidate when trend names overlap. */
export function dedupeOverlappingCandidates(candidates: DishTrendCandidate[]): DishTrendCandidate[] {
  return dedupeCandidatesByOverlap(candidates);
}

/**
 * Deterministic ranking: score candidates, take top 5 as Right Now, then up to 3 non-overlapping
 * remainder with strongest emerging affinity as About to Hit.
 */
export function buildFoodTrendsFromCandidates(
  candidates: DishTrendCandidate[],
): FoodTrendsPayload {
  const pool = dedupeCandidatesByOverlap(candidates);
  const scored: ScoredCandidate[] = pool.map((candidate) => {
    const primaryScore = computePrimaryScore(candidate);
    return {
      candidate,
      primaryScore,
      emergingAffinity: computeEmergingAffinity(candidate, primaryScore),
    };
  });

  scored.sort((a, b) => b.primaryScore - a.primaryScore);

  const rightSlice = scored.slice(0, RIGHT_NOW_COUNT);
  const rightNow: RightNowTrend[] = rightSlice.map((row, i) =>
    candidateToRightNowTrend(row.candidate, i + 1),
  );

  const rightTitles = rightNow.map((t) => t.trend_name);

  const remainder = scored.slice(RIGHT_NOW_COUNT);

  remainder.sort((a, b) => {
    const d = b.emergingAffinity - a.emergingAffinity;
    if (Math.abs(d) > 0.5) {
      return d > 0 ? 1 : -1;
    }
    return b.primaryScore - a.primaryScore;
  });

  const aboutToHit: AboutToHitTrend[] = [];
  for (const row of remainder) {
    if (aboutToHit.length >= ABOUT_TO_HIT_COUNT) {
      break;
    }
    const built = candidateToAboutTrend(row.candidate);
    if (aboutOverlapsRightNow(built, rightTitles)) {
      continue;
    }
    if (
      aboutToHit.some((x) => trendsOverlapAcrossSections(x.trend_name, built.trend_name))
    ) {
      continue;
    }
    const nextRank = aboutToHit.length + 1;
    aboutToHit.push({
      ...built,
      rank: nextRank,
      trend_score: aboutScoreForRank(nextRank),
    });
  }

  return {
    right_now_section_title: "Top 5 LA Food Trends Right Now",
    about_to_hit_section_title: "Top 3 About to Hit",
    right_now: rightNow.slice(0, RIGHT_NOW_COUNT),
    about_to_hit: aboutToHit.slice(0, ABOUT_TO_HIT_COUNT),
  };
}
