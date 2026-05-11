import fs from "node:fs/promises";
import path from "node:path";

import { clusterKeyForEntity } from "@/lib/signals/normalizeEntity";
import type {
  Trend,
  TrendConvergenceConfidence,
  TrendConvergenceNarrative,
  TrendConvergencePersisted,
  TrendConvergencePublicNarrative,
  TrendConvergenceState,
} from "@/types/laFoodTrend";
import type { ReservationSignalStatus } from "@/types/reservationSignal";
import { isRedditApprovedForPublicNarrative } from "@/lib/signals/sources/redditSignals";

export type { TrendConvergenceConfidence, TrendConvergenceState } from "@/types/laFoodTrend";

export type WhyItsEverywhereNarrative = TrendConvergenceNarrative;

export type TrendConvergence = {
  trendId: string;
  convergenceScore: number;
  confidence: TrendConvergenceConfidence;
  /** Distinct contributing lanes (editorial pubs bundle as one lane unless multi-pub bonus applies elsewhere). */
  sourceCount: number;
  /** 0–100 composite of how independently sources corroborate (not raw count). */
  sourceDiversity: number;
  neighborhoodCount: number;
  geoSpreadScore: number;
  persistenceScore: number;
  socialAlignmentScore: number;
  editorialAlignmentScore: number;
  reservationMomentumScore: number;
  placeDensityScore: number;
  reasons: string[];
  strongestSources: string[];
  trendState: TrendConvergenceState;
};

export type TrendHistoryConvergenceEntry = {
  entity: string;
  timestamp: string;
  week: string;
  stage: string;
  score: number;
  sourceMix?: Record<string, number>;
  supportTypes?: string[];
};

const TREND_HISTORY_PATH = path.join(process.cwd(), "data", "trend-history.json");

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseTrendHistoryJson(raw: string): TrendHistoryConvergenceEntry[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: TrendHistoryConvergenceEntry[] = [];
    for (const row of parsed) {
      if (!isRecord(row) || typeof row.entity !== "string") continue;
      out.push({
        entity: row.entity,
        timestamp: typeof row.timestamp === "string" ? row.timestamp : "",
        week: typeof row.week === "string" ? row.week : "",
        stage: typeof row.stage === "string" ? row.stage : "",
        score: typeof row.score === "number" && Number.isFinite(row.score) ? row.score : 0,
        sourceMix: isRecord(row.sourceMix) ? (row.sourceMix as Record<string, number>) : undefined,
        supportTypes: Array.isArray(row.supportTypes)
          ? row.supportTypes.filter((x): x is string => typeof x === "string")
          : undefined,
      });
    }
    return out;
  } catch {
    return [];
  }
}

export async function loadTrendHistoryForConvergence(): Promise<TrendHistoryConvergenceEntry[]> {
  try {
    const raw = await fs.readFile(TREND_HISTORY_PATH, "utf-8");
    return parseTrendHistoryJson(raw);
  } catch {
    return [];
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/** Macro regions for “culturally distinct” spread bonus (subset of LA). */
const NEIGHBORHOOD_REGION: Record<string, number> = {
  koreatown: 0,
  "thai town": 0,
  "westlake": 0,
  "silver lake": 1,
  "echo park": 1,
  "highland park": 1,
  "glassell park": 1,
  "boyle heights": 2,
  "lincoln heights": 2,
  "chinatown": 3,
  "downtown la": 3,
  "arts district": 3,
  venice: 4,
  "santa monica": 4,
  sawtelle: 4,
  "culver city": 4,
  "west hollywood": 5,
  fairfax: 5,
  pasadena: 6,
  "long beach": 7,
  inglewood: 7,
};

function normalizeNeighborhoodLabel(s: string): string {
  return s.trim().toLowerCase();
}

function regionIdForNeighborhood(name: string): number | null {
  const key = normalizeNeighborhoodLabel(name);
  if (NEIGHBORHOOD_REGION[key] != null) return NEIGHBORHOOD_REGION[key];
  for (const [k, id] of Object.entries(NEIGHBORHOOD_REGION)) {
    if (key.includes(k) || k.includes(key)) return id;
  }
  return null;
}

type AuthorityHit = { label: string; weight: number };

const AUTHORITY_RULES: Array<{ re: RegExp; label: string; weight: number }> = [
  { re: /\bl\.?a\.?\s*times|latimes|los\s+angeles\s+times\b/i, label: "LA Times", weight: 1 },
  { re: /\beater\b/i, label: "Eater LA", weight: 0.95 },
  { re: /\binfatuation\b/i, label: "Infatuation LA", weight: 0.92 },
  { re: /\bresy\b/i, label: "Resy Editorial", weight: 0.88 },
  { re: /\btime\s*out\b/i, label: "Time Out LA", weight: 0.82 },
  { re: /\bbon\s*app[eé]tit\b/i, label: "Bon Appétit", weight: 0.8 },
  { re: /\beditorial\b/i, label: "Editorial", weight: 0.45 },
  { re: /\bmanual\b/i, label: "Manual editorial", weight: 0.35 },
  { re: /\breddit\b/i, label: "Reddit", weight: 0.28 },
  { re: /\bgoogle\b|maps\b|places\b/i, label: "Google Places", weight: 0.55 },
  { re: /\btiktok\b/i, label: "TikTok", weight: 0.2 },
  { re: /\binstagram\b|\big\b/i, label: "Instagram", weight: 0.2 },
];

function authorityHitsFromSources(sources: readonly string[]): AuthorityHit[] {
  const hits: AuthorityHit[] = [];
  for (const line of sources) {
    const text = line.trim();
    if (!text) continue;
    for (const rule of AUTHORITY_RULES) {
      if (rule.re.test(text)) {
        hits.push({ label: rule.label, weight: rule.weight });
        break;
      }
    }
  }
  return hits;
}

function distinctEditorialAuthorities(hits: AuthorityHit[]): string[] {
  const editorialLabels = new Set([
    "LA Times",
    "Eater LA",
    "Infatuation LA",
    "Resy Editorial",
    "Time Out LA",
    "Bon Appétit",
    "Editorial",
    "Manual editorial",
  ]);
  const out = new Set<string>();
  for (const h of hits) {
    if (editorialLabels.has(h.label)) out.add(h.label);
  }
  return [...out];
}

function editorialAlignmentFromSources(sources: readonly string[]): { score: number; pubs: string[] } {
  const hits = authorityHitsFromSources(sources);
  const pubs = distinctEditorialAuthorities(hits);
  let raw = 0;
  for (const h of hits) {
    raw += h.weight * 24;
  }
  if (pubs.length >= 2) raw += 18;
  if (pubs.length >= 3) raw += 12;
  return { score: clamp(Math.round(raw), 0, 100), pubs };
}

function hasGoogleGeoEvidence(trend: Trend): boolean {
  if (trend.evidenceSummary?.trim()) return true;
  if (trend.listingsSignals?.length) return true;
  for (const r of trend.restaurants ?? []) {
    if (r.googleMapsUrl?.trim()) return true;
    const src = r.source?.toLowerCase() ?? "";
    if (src.includes("google") || src.includes("maps")) return true;
  }
  for (const s of trend.sources ?? []) {
    if (/\bgoogle|maps|places\b/i.test(s)) return true;
  }
  return false;
}

function reservationMomentum(signals: Trend["reservationSignals"]): number {
  if (!signals?.length) return 0;
  const w: Record<ReservationSignalStatus, number> = {
    hard_to_book: 32,
    sold_out: 38,
    limited_availability: 22,
    new_drop: 26,
    event: 14,
  };
  let sum = 0;
  for (const row of signals) {
    const st = row.status;
    if (st && st in w) sum += w[st];
  }
  return clamp(Math.round(40 * Math.tanh(sum / 55)), 0, 100);
}

function socialRawScore(trend: Trend): number {
  const manual = trend.manualSocialSignals;
  let pts = 0;
  if (manual?.tiktokSpotted) pts += 22;
  if (manual?.instagramSpotted) pts += 22;
  pts += clamp((trend.socialSignals?.length ?? 0) * 14, 0, 44);
  return clamp(pts, 0, 100);
}

function placeDensityScore(trend: Trend): number {
  const rc = trend.restaurants?.length ?? 0;
  const mc = trend.menuItems?.length ?? 0;
  const nh = new Set<string>();
  for (const n of trend.neighborhoods ?? []) {
    if (n.trim()) nh.add(normalizeNeighborhoodLabel(n));
  }
  for (const r of trend.restaurants ?? []) {
    if (r.neighborhood?.trim()) nh.add(normalizeNeighborhoodLabel(r.neighborhood));
  }
  const base = Math.log1p(rc) * 26 + Math.log1p(mc) * 9 + nh.size * 6;
  const signalBoost = clamp((trend.signalScore ?? 0) / 14, 0, 12);
  return clamp(Math.round(base + signalBoost), 0, 100);
}

function neighborhoodsForTrend(trend: Trend): string[] {
  const nh = new Set<string>();
  for (const n of trend.neighborhoods ?? []) {
    if (n.trim()) nh.add(n.trim());
  }
  for (const r of trend.restaurants ?? []) {
    if (r.neighborhood?.trim()) nh.add(r.neighborhood.trim());
  }
  return [...nh];
}

function geoSpreadScoreFromNeighborhoods(names: string[]): { score: number; regionCount: number } {
  const ids = new Set<number>();
  for (const n of names) {
    const id = regionIdForNeighborhood(n);
    if (id != null) ids.add(id);
  }
  const regionCount = ids.size;
  const nhCount = names.length;
  const partA = clamp(Math.log1p(nhCount) * 28, 0, 56);
  const partB = clamp(regionCount * 14, 0, 44);
  return { score: clamp(Math.round(partA + partB), 0, 100), regionCount };
}

function laneFlags(trend: Trend, hasEditorial: boolean, googleGeo: boolean): Record<string, boolean> {
  const sourcesText = (trend.sources ?? []).join(" ").toLowerCase();
  const hasReddit = /\breddit\b/i.test(sourcesText) || authorityHitsFromSources(trend.sources ?? []).some((h) => h.label === "Reddit");
  const manualSocial =
    Boolean(trend.manualSocialSignals?.tiktokSpotted || trend.manualSocialSignals?.instagramSpotted) ||
    (trend.socialSignals?.length ?? 0) > 0;
  const hasReservation = (trend.reservationSignals?.length ?? 0) > 0;
  const hasListings = (trend.listingsSignals?.length ?? 0) > 0;
  return {
    editorial: hasEditorial || authorityHitsFromSources(trend.sources ?? []).some((h) => h.label === "Editorial"),
    google: googleGeo,
    community: hasReddit,
    social_proxy: manualSocial,
    reservation: hasReservation,
    listings: hasListings,
  };
}

function sourceDiversityScoreFromLanes(lanes: Record<string, boolean>, independentEditorialCount: number): { count: number; score: number } {
  let c = 0;
  if (lanes.editorial) c += 1;
  if (lanes.google) c += 1;
  if (lanes.community) c += 1;
  if (lanes.social_proxy) c += 1;
  if (lanes.reservation) c += 1;
  if (lanes.listings) c += 1;
  const scoreTable: Record<number, number> = { 0: 5, 1: 22, 2: 46, 3: 64, 4: 78, 5: 88, 6: 94 };
  let score = scoreTable[Math.min(6, c)] ?? 94;
  if (independentEditorialCount >= 2) score = clamp(score + 10, 0, 100);
  return { count: c, score };
}

function persistenceFromHistory(entityKey: string, history: TrendHistoryConvergenceEntry[]): { score: number; velocity: number; weeks: number } {
  const rows = history.filter((h) => clusterKeyForEntity(h.entity) === entityKey);
  if (!rows.length) return { score: 14, velocity: 0, weeks: 0 };
  const weeks = new Set(rows.map((r) => r.week).filter(Boolean));
  const sorted = [...rows].sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
  const recent = sorted.slice(0, 5).map((r) => r.score);
  const velocity =
    recent.length >= 2 ? clamp((recent[0]! - recent[recent.length - 1]!) / Math.max(1, recent.length) / 24, -1, 1) : 0;
  const weekScore = clamp([...weeks].length * 16, 0, 56);
  const consistency = clamp(Math.log1p(rows.length) * 10, 0, 34);
  const velBonus = velocity > 0.08 ? 12 : velocity < -0.08 ? -6 : 0;
  return {
    score: clamp(Math.round(weekScore + consistency + velBonus + 8), 0, 100),
    velocity,
    weeks: weeks.size,
  };
}

function applyWeakSignalCaps(args: {
  rawConvergence: number;
  editorialPubs: string[];
  independentEditorial: number;
  googleGeo: boolean;
  neighborhoodCount: number;
  lanes: Record<string, boolean>;
  socialOnly: boolean;
}): number {
  let v = args.rawConvergence;
  const singleEditorial = args.independentEditorial <= 1 && args.editorialPubs.length <= 1;
  if (args.socialOnly && !args.googleGeo && args.independentEditorial === 0) v = Math.min(v, 28);
  if (singleEditorial && !args.googleGeo && args.neighborhoodCount <= 1) v = Math.min(v, 48);
  if (args.independentEditorial === 0 && !args.googleGeo) v = Math.min(v, 42);
  if (!args.lanes.editorial && !args.googleGeo && (args.lanes.social_proxy || args.lanes.community)) v = Math.min(v, 38);
  return clamp(Math.round(v), 0, 100);
}

export type ComputeTrendConvergenceOptions = {
  historyEntries?: TrendHistoryConvergenceEntry[];
};

function convergenceVelocity(trend: Trend, historyVel: number): number {
  const m = ((trend.momentumScore ?? 50) - 50) / 50;
  return clamp(historyVel * 0.55 + m * 0.45, -1, 1);
}

export function classifyTrendConvergenceState(
  convergenceScore: number,
  persistenceScore: number,
  velocity: number,
): TrendConvergenceState {
  if (velocity < -0.12 && convergenceScore < 72) return "cooling";
  if (convergenceScore < 30) return "weak_signal";
  if (convergenceScore < 44) return "emerging";
  if (convergenceScore < 58) return velocity > 0.08 ? "rising" : "emerging";
  if (convergenceScore < 72) return velocity > 0.1 ? "rising" : "stabilizing";
  if (convergenceScore >= 84 && persistenceScore >= 52) return "mainstream";
  if (convergenceScore >= 76) return "stabilizing";
  return velocity > 0.05 ? "rising" : "stabilizing";
}

function narrativeConfidenceBand(c: TrendConvergence): TrendConvergenceConfidence {
  const pubs = c.strongestSources.filter((s) =>
    ["LA Times", "Eater LA", "Infatuation LA", "Resy Editorial", "Time Out LA", "Bon Appétit"].includes(s),
  ).length;
  if (c.convergenceScore >= 74 && pubs >= 2 && (c.neighborhoodCount >= 2 || c.sourceCount >= 3)) return "high";
  if (c.convergenceScore >= 74 && pubs >= 1 && c.neighborhoodCount >= 3) return "high";
  if (c.convergenceScore >= 52 && (pubs >= 1 || c.sourceCount >= 3)) return "medium";
  if (c.convergenceScore >= 38 && c.sourceCount >= 2) return "medium";
  return "low";
}

function buildReasons(args: {
  pubs: string[];
  nh: string[];
  regionCount: number;
  persistenceWeeks: number;
  lanes: Record<string, boolean>;
  reservation: number;
  social: number;
  google: boolean;
}): string[] {
  const reasons: string[] = [];
  if (args.pubs.length >= 2) reasons.push(`Corroborated across ${args.pubs.slice(0, 3).join(", ")}`);
  else if (args.pubs.length === 1) reasons.push(`Editorial signal from ${args.pubs[0]}`);
  else reasons.push("Limited named editorial authority in source list — treat as provisional");
  if (args.nh.length >= 3) reasons.push(`Geographic footprint spans ${args.nh.length} neighborhoods`);
  else if (args.nh.length === 2) reasons.push(`Two-neighborhood footprint (${args.nh.join(" · ")})`);
  else if (args.nh.length === 1) reasons.push(`Mostly concentrated in ${args.nh[0]}`);
  if (args.regionCount >= 3) reasons.push("Cross-regional LA spread (distinct area clusters)");
  if (args.google) reasons.push("Google Places / geo evidence supports venue-level concentration");
  if (args.persistenceWeeks >= 3) reasons.push(`Seen in ${args.persistenceWeeks}+ weekly history snapshots`);
  else if (args.persistenceWeeks >= 1) reasons.push("Early persistence in trend history");
  else reasons.push("No multi-week history yet — spike risk");
  if (args.lanes.reservation && args.reservation > 15) reasons.push("Reservation demand metadata reinforces (supporting only)");
  if (args.lanes.social_proxy && args.social > 10)
    reasons.push("Manual social proxy tags present — amplification only, not standalone proof");
  return reasons.slice(0, 8);
}

export function computeTrendConvergence(trend: Trend, opts?: ComputeTrendConvergenceOptions): TrendConvergence {
  const history = opts?.historyEntries ?? [];
  const entityKey = clusterKeyForEntity(trend.name) || trend.id;
  const { score: editorialAlignmentScore, pubs } = editorialAlignmentFromSources(trend.sources ?? []);
  const independentEditorial = pubs.filter((p) => p !== "Editorial" && p !== "Manual editorial").length;
  const googleGeo = hasGoogleGeoEvidence(trend);
  const nhList = neighborhoodsForTrend(trend);
  const { score: geoSpreadScore, regionCount } = geoSpreadScoreFromNeighborhoods(nhList);
  const { score: persistenceScore, velocity: histVel, weeks: persistenceWeeks } = persistenceFromHistory(
    entityKey,
    history,
  );
  const placeDensity = placeDensityScore(trend);
  const reservationMomentumScore = reservationMomentum(trend.reservationSignals);
  const socialRaw = socialRawScore(trend);
  const lanes = laneFlags(trend, pubs.length > 0, googleGeo);
  const { count: sourceCount, score: sourceDiversityScore } = sourceDiversityScoreFromLanes(lanes, pubs.length);

  const editorialOrGeo = clamp((editorialAlignmentScore + geoSpreadScore) / 200, 0, 1);
  const socialEffective = socialRaw * (0.28 + 0.72 * editorialOrGeo);
  const reservationEffective = reservationMomentumScore * (0.35 + 0.65 * Math.min(1, editorialOrGeo + persistenceScore / 220));

  const weighted =
    editorialAlignmentScore * 0.28 +
    sourceDiversityScore * 0.17 +
    geoSpreadScore * 0.18 +
    persistenceScore * 0.14 +
    placeDensity * 0.11 +
    socialEffective * 0.06 +
    reservationEffective * 0.06;

  const socialOnly = lanes.social_proxy && !lanes.editorial && !lanes.google;
  let convergenceScore = applyWeakSignalCaps({
    rawConvergence: weighted,
    editorialPubs: pubs,
    independentEditorial,
    googleGeo,
    neighborhoodCount: nhList.length,
    lanes,
    socialOnly,
  });

  const vel = convergenceVelocity(trend, histVel);
  const trendState = classifyTrendConvergenceState(convergenceScore, persistenceScore, vel);

  const strongest = new Set<string>();
  for (const p of pubs) strongest.add(p);
  if (lanes.google) strongest.add("Google Places");
  if (lanes.community) strongest.add("Reddit");
  if (lanes.social_proxy) strongest.add("Social proxy");
  if (lanes.reservation) strongest.add("Reservations");
  if (lanes.listings) strongest.add("Listings");

  const strongestSources = [...strongest].slice(0, 6);
  const reasons = buildReasons({
    pubs,
    nh: nhList,
    regionCount,
    persistenceWeeks,
    lanes,
    reservation: reservationMomentumScore,
    social: socialEffective,
    google: googleGeo,
  });

  const base: TrendConvergence = {
    trendId: trend.id,
    convergenceScore,
    confidence: "low",
    sourceCount,
    sourceDiversity: sourceDiversityScore,
    neighborhoodCount: nhList.length,
    geoSpreadScore,
    persistenceScore,
    socialAlignmentScore: Math.round(socialEffective),
    editorialAlignmentScore,
    reservationMomentumScore,
    placeDensityScore: placeDensity,
    reasons,
    strongestSources,
    trendState,
  };
  base.confidence = narrativeConfidenceBand(base);
  if (independentEditorial <= 1 && nhList.length <= 1 && !googleGeo) base.confidence = "low";
  if (base.convergenceScore >= 78 && base.confidence === "medium" && independentEditorial >= 2) base.confidence = "high";
  return base;
}

export function buildWhyItsEverywhereNarrative(trend: Trend, convergence: TrendConvergence): WhyItsEverywhereNarrative {
  const pubs = convergence.strongestSources.filter((s) => s !== "Google Places" && s !== "Reddit" && s !== "Social proxy");
  const geo = trend.neighborhoods?.length
    ? trend.neighborhoods.slice(0, 4).join(", ")
    : convergence.neighborhoodCount
      ? `${convergence.neighborhoodCount} areas`
      : "limited geography";
  let headlineReason = "";
  if (pubs.length >= 2 && convergence.neighborhoodCount >= 2) {
    headlineReason = `Seen across LA editorial coverage (${pubs.slice(0, 2).join(" & ")}) and multiple neighborhoods (${geo}).`;
  } else if (pubs.length >= 2) {
    headlineReason = `Multiple independent publications (${pubs.slice(0, 2).join(" & ")}) point to the same movement.`;
  } else if (convergence.neighborhoodCount >= 3 && convergence.geoSpreadScore >= 55) {
    headlineReason = `Geographic spread across ${convergence.neighborhoodCount} neighborhoods suggests broad local uptake.`;
  } else if (pubs.length === 1) {
    headlineReason = `Early editorial visibility (${pubs[0]}); corroboration still thin for a “citywide” claim.`;
  } else {
    headlineReason = `Signal is mostly non-editorial or manual — narrative should stay cautious until publications align.`;
  }

  const supportReasons: string[] = [];
  if (pubs.length) supportReasons.push(`Mentioned or tagged via: ${[...new Set(pubs)].slice(0, 4).join(", ")}`);
  if (convergence.strongestSources.includes("Google Places"))
    supportReasons.push("Venue- and maps-linked evidence clusters with the theme");
  if (trend.manualSocialSignals?.tiktokSpotted) supportReasons.push("Manual TikTok proxy activity recorded (supporting)");
  if (trend.manualSocialSignals?.instagramSpotted) supportReasons.push("Manual Instagram proxy activity recorded (supporting)");
  if (convergence.reservationMomentumScore >= 20) supportReasons.push("Reservation-demand cues (hard-to-book / scarcity) align");
  if (convergence.persistenceScore >= 40) supportReasons.push("Repeated over multiple tracking windows (persistence)");
  if (supportReasons.length === 0) supportReasons.push(convergence.reasons[0] ?? "Continue monitoring cross-source alignment before upgrading confidence.");

  return { headlineReason, supportReasons: supportReasons.slice(0, 5) };
}

const INTERNAL_SOURCE_LABELS = new Set(["Google Places", "Social proxy", "Reddit", "Listings", "Reservations"]);

function editorialLabelsFromStrongest(strongest: string[]): string[] {
  return strongest.filter((s) => !INTERNAL_SOURCE_LABELS.has(s));
}

function formatPubNameForPublic(pub: string): string {
  return /^manual\s+editorial$/i.test(pub.trim()) ? "editorial notes" : pub;
}

export type BuildPublicConvergenceNarrativeOptions = {
  /** Test hook / override; defaults to `isRedditApprovedForPublicNarrative()`. */
  redditApprovedForPublicCopy?: boolean;
};

/**
 * Replace backend/source connector labels with public-safe wording; strip Reddit naming when copy must not imply that stack.
 */
export function sanitizePublicConvergenceCopy(
  text: string,
  _opts: { redditApprovedForPublicCopy: boolean },
): string {
  let s = text;
  const pairs: Array<[RegExp, string]> = [
    [/\bgoogle\s+places\b/gi, "restaurant listings"],
    [/\bmanual\s+editorial\b/gi, "editorial notes"],
    [/\btiktok\s+proxy\b/gi, "social chatter"],
    [/\binstagram\s+proxy\b/gi, "social chatter"],
    [/\bsocial\s+proxy\b/gi, "social chatter"],
  ];
  for (const [re, rep] of pairs) s = s.replace(re, rep);
  s = s.replace(/\breddit\b/gi, "food forums");
  s = s.replace(/\br\/[A-Za-z0-9_]+\b/g, "");
  const clinical: Array<[RegExp, string]> = [
    [/\bsource\s+diversity\b/gi, "mix of voices"],
    [/\bconvergence\s+score\b/gi, "momentum"],
    [/\bpersistence\s+score\b/gi, "staying power"],
    [/\bsignal\s+density\b/gi, "buzz"],
    [/\bconfidence\s+weighting\b/gi, "read of the room"],
    [/\bmanual\s+proxy\b/gi, "manual tags"],
    [/\btiktok\s+scraping\b/gi, "social chatter"],
    [/\binstagram\s+scraping\b/gi, "social chatter"],
    [/\bgoogle\s+says\b/gi, "the listings suggest"],
    [/\breddit\s+says\b/gi, "forums suggest"],
    [/\bthe\s+pipeline\b/gi, "the weekly routine"],
    [/\bnormalized\s+places?\b/gi, "mapped venues"],
    [/\bnormalized\s+signals?\b/gi, "signals"],
    [/\btrend\s+candidates?\b/gi, "picks"],
  ];
  for (const [re, rep] of clinical) s = s.replace(re, rep);
  s = s.replace(/\s{2,}/g, " ").trim();
  return s;
}

/**
 * Food-media tone for public cards: no vendor-as-journalist, no “live scrape” implications.
 */
export function buildPublicConvergenceNarrative(
  trend: Trend,
  c: TrendConvergence,
  options?: BuildPublicConvergenceNarrativeOptions,
): TrendConvergencePublicNarrative {
  const redditOk = options?.redditApprovedForPublicCopy ?? isRedditApprovedForPublicNarrative();
  const pubs = editorialLabelsFromStrongest(c.strongestSources).map(formatPubNameForPublic);
  const hoods = [...new Set((trend.neighborhoods ?? []).map((x) => x.trim()).filter(Boolean))].slice(0, 4);
  const hoodPhrase =
    hoods.length >= 3
      ? `${hoods.slice(0, 2).join(", ")}, and elsewhere`
      : hoods.length === 2
        ? `${hoods[0]} and ${hoods[1]}`
        : hoods.length === 1
          ? hoods[0]!
          : "";

  let primaryLine: string;
  if (c.confidence === "high" && pubs.length >= 2 && c.neighborhoodCount >= 2) {
    primaryLine = `${pubs.slice(0, 2).join(" and ")} are in sync: ${trend.name} is crossing neighborhoods and reading bigger than a one-post wonder${hoodPhrase ? ` (${hoodPhrase})` : ""}.`;
  } else if (c.confidence === "high" && pubs.length >= 1) {
    primaryLine = `${pubs[0]} is leaning in, and ${trend.name} is showing up across more of LA than a flash-in-the-pan stunt${hoodPhrase ? ` (${hoodPhrase})` : ""}.`;
  } else if (c.confidence === "medium") {
    if (pubs.length >= 2) {
      primaryLine = `Overlapping dispatches from ${pubs.slice(0, 2).join(" and ")}${hoodPhrase ? `, with kitchens staking claims in ${hoodPhrase}` : ""}—same craving, different bylines.`;
    } else if (pubs.length === 1) {
      primaryLine = `${pubs[0]} put this on our radar; we’re watching whether ${trend.name} keeps traveling or stalls out.`;
    } else {
      primaryLine = `Enough ${trend.name} chatter to stay curious${hoodPhrase ? ` (${hoodPhrase})` : ""}—interesting, not ordained.`;
    }
  } else {
    if (pubs.length >= 1) {
      primaryLine = `One sharp read (${pubs[0]}) is flagging this early—the city isn’t in full chorus yet, but the idea is starting to travel.`;
    } else {
      primaryLine = `Small echoes around ${trend.name}${hoodPhrase ? `—think ${hoodPhrase}` : ""}—worth watching, not yet a full-on wave.`;
    }
  }

  const supportingLines: string[] = [];
  if (c.strongestSources.includes("Google Places") || c.geoSpreadScore >= 42) {
    supportingLines.push("Menus and chalkboards keep circling the same craving—it’s quietly spreading in more than one pocket.");
  }
  if (redditOk && c.strongestSources.includes("Reddit")) {
    supportingLines.push("Neighborhood forums are picking up the thread, too—we read it as extra texture, not the main story.");
  }
  if (trend.manualSocialSignals?.tiktokSpotted || trend.manualSocialSignals?.instagramSpotted) {
    supportingLines.push("There’s a parallel hum in food-video culture and the social chatter we’re watching—context, not a verdict.");
  }
  if (c.reservationMomentumScore >= 28 && (trend.reservationSignals?.length ?? 0) > 0) {
    supportingLines.push("Reservations are behaving like this matters—harder seats, faster sellouts, straight-up restaurant momentum.");
  }
  if (c.persistenceScore >= 48) {
    supportingLines.push("It keeps resurfacing on our weekly pass—not a one-week glitch.");
  }

  const scrubOpts = { redditApprovedForPublicCopy: redditOk };
  return {
    primaryLine: sanitizePublicConvergenceCopy(primaryLine, scrubOpts),
    supportingLines: supportingLines.slice(0, 2).map((line) => sanitizePublicConvergenceCopy(line, scrubOpts)),
  };
}

export type BuildPersistedTrendConvergenceOptions = {
  publicNarrative?: BuildPublicConvergenceNarrativeOptions;
};

export function buildPersistedTrendConvergence(
  trend: Trend,
  history: TrendHistoryConvergenceEntry[],
  computedAt: string,
  opts?: BuildPersistedTrendConvergenceOptions,
): TrendConvergencePersisted {
  const conv = computeTrendConvergence(trend, { historyEntries: history });
  const draft = buildWhyItsEverywhereNarrative(trend, conv);
  const whyItsEverywhereNarrative: TrendConvergenceNarrative = {
    headlineReason: draft.headlineReason,
    supportReasons: draft.supportReasons,
  };
  const publicNarrative = buildPublicConvergenceNarrative(trend, conv, opts?.publicNarrative);
  return {
    convergenceScore: conv.convergenceScore,
    confidence: conv.confidence,
    trendState: conv.trendState,
    strongestSources: conv.strongestSources,
    sourceDiversity: conv.sourceDiversity,
    geoSpreadScore: conv.geoSpreadScore,
    persistenceScore: conv.persistenceScore,
    reasons: conv.reasons,
    whyItsEverywhereNarrative,
    publicNarrative,
    computedAt,
  };
}

export function computeConvergenceForTrendDataset(
  trends: readonly Trend[],
  historyEntries?: TrendHistoryConvergenceEntry[],
): TrendConvergence[] {
  const hist = historyEntries ?? [];
  return trends.map((t) => computeTrendConvergence(t, { historyEntries: hist }));
}
