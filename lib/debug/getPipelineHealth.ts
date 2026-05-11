/**
 * Pipeline/source health is descriptive only: it must not invent signals.
 * - Google Places: real HTTP to the Places API when configured.
 * - Reservations rollup: enabled only when trend JSON includes `reservationSignals`
 *   (manual/internal metadata). No Resy/OpenTable/Tock HTTP here.
 * - TikTok/Instagram proxies: tag counts from editorial/manual fields only (no scraping).
 * - Reddit: `getRedditSignals` is currently a stub—no Reddit posts merge into candidates.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { LA_FOOD_TRENDS_DATA_FILE, readLaFoodTrendsDataFile } from "@/lib/laFoodTrendsData";
import { envPresenceFlags } from "@/lib/pipelineAudit";
import {
  getEditorialFeedDiagnostics,
  getEditorialSignals,
  getLastEditorialIngestionStats,
} from "@/lib/signals/sources/editorialSignals";
import {
  getGooglePlacesDiagnostics,
  getGooglePlacesSignals,
} from "@/lib/signals/sources/googlePlacesSignals";
import { getRedditSignals } from "@/lib/signals/sources/redditSignals";
import { getReservationSignals } from "@/lib/signals/sources/reservationSignals";

export type HealthStatus = "green" | "yellow" | "red";
export type SourceCategory =
  | "editorial"
  | "community"
  | "review"
  | "reservation"
  | "manual"
  | "social_proxy";
export type SourceLifecycle = "active" | "degraded" | "disabled";

export type SourceHealth = {
  id: string;
  label: string;
  category: SourceCategory;
  lifecycle: SourceLifecycle;
  status: HealthStatus;
  statusDetail:
    | "active"
    | "active_no_matches"
    | "degraded"
    | "disabled_credentials_missing"
    | "disabled_connector";
  enabled: boolean;
  credentialRequirements: string[];
  missingCredentials: string[];
  freshnessWindowMinutes: number | null;
  lastAttemptedAt: string | null;
  lastSuccessfulAt: string | null;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  fetchedItems: number;
  normalizedArticles: number;
  articlesWithExtractableEntities: number;
  extractedEntities: number;
  candidateSignals: number;
  candidateTrends: number;
  rejectedByCategory: number;
  rejectedByConfidence: number;
  rejectedByDeduplication: number;
  finalSignals: number;
  freshnessMinutes: number | null;
  signalCount: number;
  parseCount: number;
  failureCount: number;
  stale: boolean;
  confidence: number;
  failureReason: string | null;
  debugNotes: string[];
  notes: string[];
  placesFetched?: number;
  normalizedPlaces?: number;
  geoPointsMapped?: number;
  cuisineEntitiesExtracted?: number;
  trendCandidatesGenerated?: number;
  geoPoints?: Array<{
    name: string;
    lat: number;
    lng: number;
    neighborhood: string | null;
    cuisines?: string[];
    types?: string[];
    rating?: number | null;
    reviewCount?: number | null;
    source?: string;
  }>;
};

export type JobHealth = {
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  durationMs: number | null;
  status: HealthStatus;
  errorMessage: string | null;
};

export type StorageHealth = {
  exists: boolean;
  readable: boolean;
  lastModified: string | null;
  entryCount: number;
  stale: boolean;
  status: HealthStatus;
  notes: string[];
};

export type PipelineHealthPayload = {
  generatedAt: string;
  overallStatus: HealthStatus;
  jobs: {
    weeklyRefresh: JobHealth;
    weekendRefresh: JobHealth;
    redditPull: JobHealth;
    trendUpdate: JobHealth;
  };
  sources: Record<string, SourceHealth>;
  storage: {
    foodTrendData: StorageHealth;
    trendHistory: StorageHealth;
  };
};

function minutesSince(iso: string | null, nowMs: number): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.round((nowMs - t) / 60000));
}

function staleByMinutes(minutes: number | null, threshold: number): boolean {
  return minutes != null && minutes > threshold;
}

function sourceStatus(args: {
  lifecycle: SourceLifecycle;
  stale: boolean;
  failureCount: number;
  signalCount: number;
}): HealthStatus {
  if (args.lifecycle === "disabled") return "yellow";
  if (args.lifecycle === "degraded") return "red";
  if (args.failureCount > 0 || args.stale) return "red";
  if (args.signalCount === 0) return "yellow";
  return "green";
}

function storageStatus(args: {
  exists: boolean;
  readable: boolean;
  stale: boolean;
}): HealthStatus {
  if (!args.exists || !args.readable) return "red";
  if (args.stale) return "yellow";
  return "green";
}

async function storageHealthForTrends(nowMs: number): Promise<StorageHealth> {
  const notes: string[] = [];
  try {
    const stat = await fs.stat(LA_FOOD_TRENDS_DATA_FILE);
    const raw = await fs.readFile(LA_FOOD_TRENDS_DATA_FILE, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    const trends = Array.isArray((parsed as Record<string, unknown>)?.trends)
      ? (((parsed as Record<string, unknown>).trends as unknown[]) ?? [])
      : [];
    const about = Array.isArray((parsed as Record<string, unknown>)?.aboutToHit)
      ? (((parsed as Record<string, unknown>).aboutToHit as unknown[]) ?? [])
      : [];
    const entryCount = trends.length + about.length;
    const lastModified = stat.mtime.toISOString();
    const stale = staleByMinutes(minutesSince(lastModified, nowMs), 7 * 24 * 60);
    if (entryCount === 0) notes.push("trend data file contains zero trend entries");
    return {
      exists: true,
      readable: true,
      lastModified,
      entryCount,
      stale,
      status: storageStatus({ exists: true, readable: true, stale }),
      notes,
    };
  } catch (e) {
    notes.push(`unable to read trend data: ${e instanceof Error ? e.message : String(e)}`);
    return {
      exists: false,
      readable: false,
      lastModified: null,
      entryCount: 0,
      stale: true,
      status: "red",
      notes,
    };
  }
}

const TREND_HISTORY_FILE = path.join(process.cwd(), "data", "trend-history.json");

async function storageHealthForHistory(nowMs: number): Promise<StorageHealth> {
  const notes: string[] = [];
  try {
    const stat = await fs.stat(TREND_HISTORY_FILE);
    const raw = await fs.readFile(TREND_HISTORY_FILE, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    const entries = Array.isArray(parsed) ? parsed : [];
    const entryCount = entries.length;
    const lastModified = stat.mtime.toISOString();
    const stale = staleByMinutes(minutesSince(lastModified, nowMs), 14 * 24 * 60);
    if (!Array.isArray(parsed)) notes.push("trend history file is not an array");
    return {
      exists: true,
      readable: true,
      lastModified,
      entryCount,
      stale,
      status: storageStatus({ exists: true, readable: true, stale }),
      notes,
    };
  } catch (e) {
    notes.push(`trend history missing or unreadable: ${e instanceof Error ? e.message : String(e)}`);
    return {
      exists: false,
      readable: false,
      lastModified: null,
      entryCount: 0,
      stale: true,
      status: "red",
      notes,
    };
  }
}

function jobStatus(lastSuccessAt: string | null, thresholdMinutes: number): HealthStatus {
  if (!lastSuccessAt) return "yellow";
  const freshness = minutesSince(lastSuccessAt, Date.now());
  if (staleByMinutes(freshness, thresholdMinutes)) return "yellow";
  return "green";
}

function disabledCredentialNotes(missingCredentials: string[]): string[] {
  return [
    "Credentials missing",
    "Connector disabled",
    "No live pulls",
    ...missingCredentials.map((name) => `Missing env: ${name}`),
  ];
}

function confidenceFromLifecycle(lifecycle: SourceLifecycle, signals: number, failures: number): number {
  if (lifecycle === "disabled") return 15;
  if (lifecycle === "degraded") return 38;
  if (failures > 0) return 52;
  if (signals === 0) return 62;
  return 86;
}

export function credentialGatedStatus(
  hasCredentials: boolean,
): { lifecycle: SourceLifecycle; statusDetail: SourceHealth["statusDetail"] } {
  return hasCredentials
    ? { lifecycle: "active", statusDetail: "active_no_matches" }
    : { lifecycle: "disabled", statusDetail: "disabled_credentials_missing" };
}

export function editorialStatusDetailFromCounts(
  failureReason: string | null,
  finalSignals: number,
): SourceHealth["statusDetail"] {
  if (failureReason) return "degraded";
  if (finalSignals === 0) return "active_no_matches";
  return "active";
}

function sourceRegistryCounters(args: {
  fetchedItems?: number;
  normalizedArticles?: number;
  articlesWithExtractableEntities?: number;
  extractedEntities?: number;
  candidateSignals?: number;
  candidateTrends?: number;
  rejectedByCategory?: number;
  rejectedByConfidence?: number;
  rejectedByDeduplication?: number;
  finalSignals?: number;
}): Pick<
  SourceHealth,
  | "fetchedItems"
  | "normalizedArticles"
  | "articlesWithExtractableEntities"
  | "extractedEntities"
  | "candidateSignals"
  | "candidateTrends"
  | "rejectedByCategory"
  | "rejectedByConfidence"
  | "rejectedByDeduplication"
  | "finalSignals"
> {
  return {
    fetchedItems: args.fetchedItems ?? 0,
    normalizedArticles: args.normalizedArticles ?? 0,
    articlesWithExtractableEntities: args.articlesWithExtractableEntities ?? 0,
    extractedEntities: args.extractedEntities ?? 0,
    candidateSignals: args.candidateSignals ?? 0,
    candidateTrends: args.candidateTrends ?? 0,
    rejectedByCategory: args.rejectedByCategory ?? 0,
    rejectedByConfidence: args.rejectedByConfidence ?? 0,
    rejectedByDeduplication: args.rejectedByDeduplication ?? 0,
    finalSignals: args.finalSignals ?? 0,
  };
}

export async function getPipelineHealthPayload(): Promise<PipelineHealthPayload> {
  const nowIso = new Date().toISOString();
  const nowMs = Date.now();
  const env = envPresenceFlags();
  const data = await readLaFoodTrendsDataFile();
  const editorialAll = await getEditorialSignals(data, nowIso);
  const editorialStats = getLastEditorialIngestionStats();
  const editorialDiagnostics = await getEditorialFeedDiagnostics();
  const redditSignals = env.hasRedditClient ? await getRedditSignals() : [];
  const placesSignals = env.hasGooglePlacesKey
    ? await getGooglePlacesSignals({
        corroboratedEntities: [
          ...(data.trends ?? []).map((trend) => trend.name),
          ...(data.aboutToHit ?? []).map((trend) => trend.name),
        ],
      })
    : [];
  const googleDiagnostics = getGooglePlacesDiagnostics();
  const reservationSignals = await getReservationSignals(data);

  const manualEditorialSignals = editorialAll.filter((s) => s.source === "manual_editorial");
  const allTrendRows = [...(data.trends ?? []), ...(data.aboutToHit ?? [])];
  const manualTiktokTagged = allTrendRows.filter(
    (trend) =>
      trend.manualSocialSignals?.tiktokSpotted === true ||
      (trend.socialSignals ?? []).some((signal) => signal.platform === "tiktok"),
  ).length;
  const manualInstagramTagged = allTrendRows.filter(
    (trend) =>
      trend.manualSocialSignals?.instagramSpotted === true ||
      (trend.socialSignals ?? []).some((signal) => signal.platform === "instagram"),
  ).length;
  const reservationSignalRows = allTrendRows.flatMap((trend) => trend.reservationSignals ?? []);
  const reservationSignalCount = reservationSignalRows.length;
  const reservationSourceSummary = Object.entries(
    reservationSignalRows.reduce<Record<string, number>>((acc, signal) => {
      acc[signal.source] = (acc[signal.source] ?? 0) + 1;
      return acc;
    }, {}),
  )
    .map(([source, count]) => `${source}:${count}`)
    .join(",");
  const reservationStatusSummary = Object.entries(
    reservationSignalRows.reduce<Record<string, number>>((acc, signal) => {
      const status = signal.status ?? "unspecified";
      acc[status] = (acc[status] ?? 0) + 1;
      return acc;
    }, {}),
  )
    .map(([status, count]) => `${status}:${count}`)
    .join(",");

  const redditFreshness = minutesSince(data.lastUpdated || null, nowMs);
  const placesFreshness = minutesSince(data.lastUpdated || null, nowMs);
  const reservationFreshness = minutesSince(data.lastUpdated || null, nowMs);
  const manualFreshness = minutesSince(data.lastUpdated || null, nowMs);

  const editorialDiagBySource = new Map(editorialDiagnostics.map((d) => [d.source, d]));
  const hasResyApiKey = Boolean(process.env.RESY_API_KEY?.trim());
  const hasOpenTableApiKey = Boolean(process.env.OPENTABLE_API_KEY?.trim());
  const hasTockApiKey = Boolean(process.env.TOCK_API_KEY?.trim());

  function editorialSourceHealth(
    sourceId: string,
    sourceKey: "eater" | "infatuation" | "latimes" | "resy_la" | "timeout_la" | "bonappetit",
    label: string,
  ): SourceHealth {
    const diag = editorialDiagBySource.get(sourceKey);
    const funnel = editorialStats.sourceSignalFunnel[sourceKey];
    const signalCount = editorialAll.filter((s) => s.source === sourceKey).length;
    const parseCount = funnel?.normalizedArticles ?? diag?.parsedArticleCount ?? 0;
    const failureReason = diag?.failureReason ?? null;
    const lifecycle: SourceLifecycle = failureReason
      ? "degraded"
      : "active";
    const statusDetail = editorialStatusDetailFromCounts(failureReason, signalCount);
    const notes: string[] = [];
    const debugNotes: string[] = [];
    if (!failureReason && signalCount === 0) notes.push("Active, no matches this run");
    if (failureReason) notes.push(`Feed issue: ${failureReason}`);
    if (funnel) {
      debugNotes.push(
        `fetchedItems=${funnel.fetchedItems}`,
        `laRelevantItems=${funnel.laRelevantItems}`,
        `normalizedArticles=${funnel.normalizedArticles}`,
        `articlesWithExtractableEntities=${funnel.articlesWithExtractableEntities}`,
        `extractedEntities=${funnel.extractedEntities}`,
        `candidateSignals=${funnel.candidateSignals}`,
        `candidateTrends=${funnel.candidateTrends}`,
        `finalSignals=${funnel.finalSignals}`,
        `rejectedByRelevance=${funnel.rejectedByRelevance}`,
        `rejectedByCategory=${funnel.rejectedByCategory}`,
        `rejectedByConfidence=${funnel.rejectedByConfidence}`,
        `rejectedByDeduplication=${funnel.rejectedByDeduplication}`,
      );
      const rejectReasonSummary = Object.entries(funnel.rejectReasons)
        .map(([k, v]) => `${k}:${v}`)
        .join(", ");
      if (rejectReasonSummary) debugNotes.push(`rejectReasons=${rejectReasonSummary}`);
      notes.push(
        `${funnel.normalizedArticles} normalized -> ${funnel.articlesWithExtractableEntities} with entities -> ${funnel.candidateTrends} candidate trends -> ${funnel.finalSignals} final signals`,
      );
    }
    return {
      id: sourceId,
      label,
      category: "editorial",
      lifecycle,
      statusDetail,
      enabled: true,
      credentialRequirements: [],
      missingCredentials: [],
      freshnessWindowMinutes: 12 * 60,
      lastAttemptedAt: diag?.fetchedAt ?? null,
      lastSuccessfulAt: failureReason ? null : diag?.fetchedAt ?? null,
      lastAttemptAt: diag?.fetchedAt ?? null,
      lastSuccessAt: failureReason ? null : diag?.fetchedAt ?? null,
      ...sourceRegistryCounters({
        fetchedItems: funnel?.fetchedItems ?? diag?.sourceDiagnostics.fetchedItems ?? 0,
        normalizedArticles: funnel?.normalizedArticles ?? parseCount,
        articlesWithExtractableEntities: funnel?.articlesWithExtractableEntities ?? 0,
        extractedEntities: funnel?.extractedEntities ?? 0,
        candidateSignals: funnel?.candidateSignals ?? signalCount,
        candidateTrends: funnel?.candidateTrends ?? 0,
        rejectedByCategory: funnel?.rejectedByCategory ?? 0,
        rejectedByConfidence: funnel?.rejectedByConfidence ?? 0,
        rejectedByDeduplication: funnel?.rejectedByDeduplication ?? 0,
        finalSignals: funnel?.finalSignals ?? signalCount,
      }),
      freshnessMinutes: minutesSince(diag?.fetchedAt ?? null, nowMs),
      signalCount,
      parseCount,
      failureCount: failureReason ? 1 : 0,
      stale: staleByMinutes(minutesSince(diag?.fetchedAt ?? null, nowMs), 12 * 60),
      confidence: confidenceFromLifecycle(lifecycle, signalCount, failureReason ? 1 : 0),
      failureReason,
      debugNotes,
      notes,
      status: "yellow",
    };
  }

  const redditMissing = env.hasRedditClient
    ? []
    : ["REDDIT_CLIENT_ID", "REDDIT_CLIENT_SECRET", "REDDIT_USER_AGENT"];
  const redditLifecycle: SourceLifecycle = !env.hasRedditClient ? "disabled" : "active";
  const redditFailureReason = !env.hasRedditClient
    ? "Credentials missing"
    : null;

  const googleMissing = env.hasGooglePlacesKey ? [] : ["GOOGLE_PLACES_API_KEY"];
  const googleLifecycle: SourceLifecycle = !env.hasGooglePlacesKey
    ? "disabled"
    : googleDiagnostics.requestStatus !== "ok"
      ? "degraded"
      : "active";
  const googleFailureReason = !env.hasGooglePlacesKey
    ? "Credentials missing"
    : googleDiagnostics.requestStatus !== "ok"
      ? googleDiagnostics.requestErrorMessage || "Google Places request failed"
      : null;

  const sources: Record<string, SourceHealth> = {
    la_times_food: editorialSourceHealth("la_times_food", "latimes", "LA Times Food"),
    eater_la: editorialSourceHealth("eater_la", "eater", "Eater LA"),
    infatuation_la: editorialSourceHealth("infatuation_la", "infatuation", "Infatuation LA"),
    resy_editorial: editorialSourceHealth("resy_editorial", "resy_la", "Resy LA Editorial"),
    timeout_la_food: editorialSourceHealth("timeout_la_food", "timeout_la", "Time Out LA Food"),
    bonappetit_la_relevant: editorialSourceHealth("bonappetit_la_relevant", "bonappetit", "Bon Appetit (LA relevant)"),
    manual_editorial: {
      id: "manual_editorial",
      label: "Manual Editorial",
      category: "manual",
      lifecycle: "active",
      statusDetail: manualEditorialSignals.length === 0 ? "active_no_matches" : "active",
      enabled: true,
      credentialRequirements: [],
      missingCredentials: [],
      freshnessWindowMinutes: 14 * 24 * 60,
      lastAttemptedAt: data.lastUpdated || null,
      lastSuccessfulAt: data.lastUpdated || null,
      lastAttemptAt: data.lastUpdated || null,
      lastSuccessAt: data.lastUpdated || null,
      ...sourceRegistryCounters({
        fetchedItems: manualEditorialSignals.length,
        normalizedArticles: manualEditorialSignals.length,
        candidateSignals: manualEditorialSignals.length,
        finalSignals: manualEditorialSignals.length,
      }),
      freshnessMinutes: manualFreshness,
      signalCount: manualEditorialSignals.length,
      parseCount: manualEditorialSignals.length,
      failureCount: 0,
      stale: staleByMinutes(manualFreshness, 14 * 24 * 60),
      confidence: confidenceFromLifecycle("active", manualEditorialSignals.length, 0),
      failureReason: null,
      debugNotes: [`fetchedItems=${manualEditorialSignals.length}`],
      notes: [
        "Manual source (human-curated)",
        "Supports manual tags for TikTok spotted / IG spotted",
      ],
      status: "green",
    },
    reddit_communities: {
      id: "reddit_communities",
      label: "Reddit LA Communities",
      category: "community",
      lifecycle: redditLifecycle,
      statusDetail: !env.hasRedditClient
        ? "disabled_credentials_missing"
        : redditSignals.length === 0
          ? "active_no_matches"
          : "active",
      enabled: env.hasRedditClient,
      credentialRequirements: ["REDDIT_CLIENT_ID", "REDDIT_CLIENT_SECRET", "REDDIT_USER_AGENT"],
      missingCredentials: redditMissing,
      freshnessWindowMinutes: 24 * 60,
      lastAttemptedAt: env.hasRedditClient ? data.lastUpdated || null : null,
      lastSuccessfulAt: redditSignals.length > 0 ? data.lastUpdated || null : null,
      lastAttemptAt: data.lastUpdated || null,
      lastSuccessAt: redditSignals.length > 0 ? data.lastUpdated || null : null,
      ...sourceRegistryCounters({
        fetchedItems: redditSignals.length,
        normalizedArticles: redditSignals.length,
        candidateSignals: redditSignals.length,
        finalSignals: redditSignals.length,
      }),
      freshnessMinutes: redditSignals.length > 0 ? redditFreshness : null,
      signalCount: redditSignals.length,
      parseCount: redditSignals.length,
      failureCount: 0,
      stale: env.hasRedditClient ? staleByMinutes(redditFreshness, 24 * 60) : false,
      confidence: confidenceFromLifecycle(redditLifecycle, redditSignals.length, 0),
      failureReason: redditFailureReason,
      debugNotes: [
        `missingEnvVars=${redditMissing.join(",") || "none"}`,
        `fetchedItems=${redditSignals.length}`,
      ],
      notes:
        redditLifecycle === "disabled"
          ? disabledCredentialNotes(redditMissing)
          : redditSignals.length === 0
            ? ["Active, no matches this run"]
            : [],
      status: "yellow",
    },
    google_places_reviews: {
      id: "google_places_reviews",
      label: "Google Places Reviews",
      category: "review",
      lifecycle: googleLifecycle,
      statusDetail: !env.hasGooglePlacesKey
        ? "disabled_credentials_missing"
        : googleLifecycle === "degraded"
          ? "degraded"
          : placesSignals.length === 0
          ? "active_no_matches"
          : "active",
      enabled: env.hasGooglePlacesKey,
      credentialRequirements: ["GOOGLE_PLACES_API_KEY"],
      missingCredentials: googleMissing,
      freshnessWindowMinutes: 24 * 60,
      lastAttemptedAt: env.hasGooglePlacesKey ? data.lastUpdated || null : null,
      lastSuccessfulAt:
        env.hasGooglePlacesKey && googleDiagnostics.requestStatus === "ok"
          ? data.lastUpdated || null
          : null,
      lastAttemptAt: env.hasGooglePlacesKey ? data.lastUpdated || null : null,
      lastSuccessAt:
        env.hasGooglePlacesKey && googleDiagnostics.requestStatus === "ok"
          ? data.lastUpdated || null
          : null,
      ...sourceRegistryCounters({
        fetchedItems: googleDiagnostics.normalizedPlaceCount,
        normalizedArticles: googleDiagnostics.normalizedPlaceCount,
        candidateSignals: googleDiagnostics.candidateSignalCount,
        finalSignals: googleDiagnostics.finalSignalCount,
      }),
      freshnessMinutes:
        env.hasGooglePlacesKey && googleDiagnostics.requestStatus === "ok" ? placesFreshness : null,
      signalCount: placesSignals.length,
      parseCount: googleDiagnostics.normalizedPlaceCount,
      failureCount: googleLifecycle === "degraded" ? 1 : 0,
      stale: env.hasGooglePlacesKey ? staleByMinutes(placesFreshness, 24 * 60) : false,
      confidence: confidenceFromLifecycle(
        googleLifecycle,
        placesSignals.length,
        googleLifecycle === "degraded" ? 1 : 0,
      ),
      failureReason: googleFailureReason,
      debugNotes: [
        `googlePlacesEnabled=${googleDiagnostics.googlePlacesEnabled}`,
        `runtimeTarget=${googleDiagnostics.runtimeTarget}`,
        `requestStatus=${googleDiagnostics.requestStatus}`,
        `requestStatusCode=${googleDiagnostics.requestStatusCode ?? "n/a"}`,
        `placesFetched=${googleDiagnostics.placesFetched}`,
        `normalizedPlaceCount=${googleDiagnostics.normalizedPlaceCount}`,
        `geoPointsMapped=${googleDiagnostics.geoPointsMapped}`,
        `cuisineEntitiesExtracted=${googleDiagnostics.cuisineEntitiesExtracted}`,
        `trendCandidatesGenerated=${googleDiagnostics.trendCandidatesGenerated}`,
        `candidateSignalCount=${googleDiagnostics.candidateSignalCount}`,
        `finalSignalCount=${googleDiagnostics.finalSignalCount}`,
        `connectivityPlaceIdPresent=${googleDiagnostics.connectivityTest.placeIdPresent}`,
        `connectivityCoordinatesPresent=${googleDiagnostics.connectivityTest.coordinatesPresent}`,
        `geocodingOk=${googleDiagnostics.geocoding.ok}`,
        ...(googleDiagnostics.localWarning ? [googleDiagnostics.localWarning] : []),
      ],
      notes:
        googleLifecycle === "disabled"
          ? disabledCredentialNotes(googleMissing)
          : googleLifecycle === "degraded"
            ? [
                googleDiagnostics.actionableMessage || "Google Places request failed",
                ...(googleDiagnostics.localWarning ? [googleDiagnostics.localWarning] : []),
              ]
            : placesSignals.length === 0
              ? ["Active, no matches this run", "Google Places API responded with zero trend-worthy entities"]
            : [],
      status: "yellow",
      placesFetched: googleDiagnostics.placesFetched,
      normalizedPlaces: googleDiagnostics.normalizedPlaceCount,
      geoPointsMapped: googleDiagnostics.geoPointsMapped,
      cuisineEntitiesExtracted: googleDiagnostics.cuisineEntitiesExtracted,
      trendCandidatesGenerated: googleDiagnostics.trendCandidatesGenerated,
      geoPoints: googleDiagnostics.normalizedPlaces
        .filter((p) => p.coordinates != null)
        .map((p) => ({
          name: p.restaurantName,
          lat: p.coordinates!.lat,
          lng: p.coordinates!.lng,
          neighborhood: p.neighborhood,
          cuisines: p.cuisines,
          types: p.types,
          rating: p.rating,
          reviewCount: p.reviewCount,
          source: "google_places_reviews",
        })),
    },
    google_places_metadata: {
      id: "google_places_metadata",
      label: "Google Places Metadata",
      category: "review",
      lifecycle: googleLifecycle,
      statusDetail: !env.hasGooglePlacesKey
        ? "disabled_credentials_missing"
        : googleLifecycle === "degraded"
          ? "degraded"
          : placesSignals.length === 0
          ? "active_no_matches"
          : "active",
      enabled: env.hasGooglePlacesKey,
      credentialRequirements: ["GOOGLE_PLACES_API_KEY"],
      missingCredentials: googleMissing,
      freshnessWindowMinutes: 24 * 60,
      lastAttemptedAt: env.hasGooglePlacesKey ? data.lastUpdated || null : null,
      lastSuccessfulAt:
        env.hasGooglePlacesKey && googleDiagnostics.requestStatus === "ok"
          ? data.lastUpdated || null
          : null,
      lastAttemptAt: env.hasGooglePlacesKey ? data.lastUpdated || null : null,
      lastSuccessAt:
        env.hasGooglePlacesKey && googleDiagnostics.requestStatus === "ok"
          ? data.lastUpdated || null
          : null,
      ...sourceRegistryCounters({
        fetchedItems: googleDiagnostics.normalizedPlaceCount,
        normalizedArticles: googleDiagnostics.normalizedPlaceCount,
        candidateSignals: googleDiagnostics.candidateSignalCount,
        finalSignals: googleDiagnostics.finalSignalCount,
      }),
      freshnessMinutes:
        env.hasGooglePlacesKey && googleDiagnostics.requestStatus === "ok" ? placesFreshness : null,
      signalCount: placesSignals.length,
      parseCount: googleDiagnostics.normalizedPlaceCount,
      failureCount: googleLifecycle === "degraded" ? 1 : 0,
      stale: env.hasGooglePlacesKey ? staleByMinutes(placesFreshness, 24 * 60) : false,
      confidence: confidenceFromLifecycle(
        googleLifecycle,
        placesSignals.length,
        googleLifecycle === "degraded" ? 1 : 0,
      ),
      failureReason: googleFailureReason,
      debugNotes: [
        `googlePlacesEnabled=${googleDiagnostics.googlePlacesEnabled}`,
        `runtimeTarget=${googleDiagnostics.runtimeTarget}`,
        `requestStatus=${googleDiagnostics.requestStatus}`,
        `requestStatusCode=${googleDiagnostics.requestStatusCode ?? "n/a"}`,
        `placesFetched=${googleDiagnostics.placesFetched}`,
        `normalizedPlaceCount=${googleDiagnostics.normalizedPlaceCount}`,
        `geoPointsMapped=${googleDiagnostics.geoPointsMapped}`,
        `cuisineEntitiesExtracted=${googleDiagnostics.cuisineEntitiesExtracted}`,
        `trendCandidatesGenerated=${googleDiagnostics.trendCandidatesGenerated}`,
        `candidateSignalCount=${googleDiagnostics.candidateSignalCount}`,
        `finalSignalCount=${googleDiagnostics.finalSignalCount}`,
        `connectivityPlaceIdPresent=${googleDiagnostics.connectivityTest.placeIdPresent}`,
        `connectivityCoordinatesPresent=${googleDiagnostics.connectivityTest.coordinatesPresent}`,
        `geocodingOk=${googleDiagnostics.geocoding.ok}`,
        ...(googleDiagnostics.localWarning ? [googleDiagnostics.localWarning] : []),
      ],
      notes:
        googleLifecycle === "disabled"
          ? disabledCredentialNotes(googleMissing)
          : googleLifecycle === "degraded"
            ? [
                googleDiagnostics.actionableMessage || "Google Places request failed",
                ...(googleDiagnostics.localWarning ? [googleDiagnostics.localWarning] : []),
              ]
            : placesSignals.length === 0
              ? ["Active, no matches this run", "Google Places API responded with zero trend-worthy entities"]
            : [],
      status: "yellow",
      placesFetched: googleDiagnostics.placesFetched,
      normalizedPlaces: googleDiagnostics.normalizedPlaceCount,
      geoPointsMapped: googleDiagnostics.geoPointsMapped,
      cuisineEntitiesExtracted: googleDiagnostics.cuisineEntitiesExtracted,
      trendCandidatesGenerated: googleDiagnostics.trendCandidatesGenerated,
      geoPoints: googleDiagnostics.normalizedPlaces
        .filter((p) => p.coordinates != null)
        .map((p) => ({
          name: p.restaurantName,
          lat: p.coordinates!.lat,
          lng: p.coordinates!.lng,
          neighborhood: p.neighborhood,
          cuisines: p.cuisines,
          types: p.types,
          rating: p.rating,
          reviewCount: p.reviewCount,
          source: "google_places_metadata",
        })),
    },
    reservations_rollup: {
      id: "reservations_rollup",
      label: "Reservations Rollup",
      category: "reservation",
      lifecycle: reservationSignalCount > 0 ? "active" : "disabled",
      statusDetail: reservationSignalCount > 0 ? "active" : "disabled_connector",
      enabled: reservationSignalCount > 0,
      credentialRequirements: [],
      missingCredentials: [],
      freshnessWindowMinutes: reservationSignalCount > 0 ? 24 * 60 : null,
      lastAttemptedAt: reservationSignalCount > 0 ? data.lastUpdated || null : null,
      lastSuccessfulAt: reservationSignalCount > 0 ? data.lastUpdated || null : null,
      lastAttemptAt: reservationSignalCount > 0 ? data.lastUpdated || null : null,
      lastSuccessAt: reservationSignalCount > 0 ? data.lastUpdated || null : null,
      ...sourceRegistryCounters({
        fetchedItems: reservationSignalCount,
        normalizedArticles: reservationSignalCount,
        candidateSignals: reservationSignals.length,
        finalSignals: reservationSignals.length,
      }),
      freshnessMinutes: reservationSignalCount > 0 ? reservationFreshness : null,
      signalCount: reservationSignals.length,
      parseCount: reservationSignalCount,
      failureCount: 0,
      stale: false,
      confidence:
        reservationSignalCount > 0
          ? confidenceFromLifecycle("active", reservationSignals.length, 0)
          : confidenceFromLifecycle("disabled", reservationSignals.length, 0),
      failureReason:
        reservationSignalCount > 0 ? null : "No trend rows include reservationSignals yet",
      debugNotes:
        reservationSignalCount > 0
          ? [
              "manual/internal reservation metadata rollup active",
              `reservationSignals=${reservationSignalCount}`,
              `reservationSources=${reservationSourceSummary || "none"}`,
              `reservationStatuses=${reservationStatusSummary || "none"}`,
            ]
          : ["rollup inactive until at least one trend defines reservationSignals (manual metadata)"],
      notes:
        reservationSignalCount > 0
          ? [
              "Manual/internal reservation metadata rollup",
              `Sources: ${reservationSourceSummary || "manual"}`,
              `Statuses: ${reservationStatusSummary || "unspecified"}`,
              "No direct Resy/OpenTable/Tock API calls from this rollup",
            ]
          : [
              "Internal/manual demand metadata only — not an external API",
              "Activate by adding reservationSignals to trend records (no seeded placeholder rows)",
            ],
      status: "yellow",
    },
    resy_venues: {
      id: "resy_venues",
      label: "Resy Venue Pages",
      category: "reservation",
      lifecycle: hasResyApiKey ? "degraded" : "disabled",
      statusDetail: hasResyApiKey ? "degraded" : "disabled_credentials_missing",
      enabled: hasResyApiKey,
      credentialRequirements: ["RESY_API_KEY"],
      missingCredentials: hasResyApiKey ? [] : ["RESY_API_KEY"],
      freshnessWindowMinutes: 24 * 60,
      lastAttemptedAt: null,
      lastSuccessfulAt: null,
      lastAttemptAt: null,
      lastSuccessAt: null,
      ...sourceRegistryCounters({}),
      freshnessMinutes: null,
      signalCount: 0,
      parseCount: 0,
      failureCount: hasResyApiKey ? 1 : 0,
      stale: false,
      confidence: confidenceFromLifecycle(hasResyApiKey ? "degraded" : "disabled", 0, hasResyApiKey ? 1 : 0),
      failureReason: hasResyApiKey ? "Connector configured but parser not implemented" : "Credentials missing",
      debugNotes: [`missingEnvVars=${hasResyApiKey ? "none" : "RESY_API_KEY"}`],
      notes: hasResyApiKey ? ["Active, no matches this run"] : disabledCredentialNotes(["RESY_API_KEY"]),
      status: "yellow",
    },
    opentable_metadata: {
      id: "opentable_metadata",
      label: "OpenTable Metadata",
      category: "reservation",
      lifecycle: hasOpenTableApiKey ? "degraded" : "disabled",
      statusDetail: hasOpenTableApiKey ? "degraded" : "disabled_credentials_missing",
      enabled: hasOpenTableApiKey,
      credentialRequirements: ["OPENTABLE_API_KEY"],
      missingCredentials: hasOpenTableApiKey ? [] : ["OPENTABLE_API_KEY"],
      freshnessWindowMinutes: 24 * 60,
      lastAttemptedAt: null,
      lastSuccessfulAt: null,
      lastAttemptAt: null,
      lastSuccessAt: null,
      ...sourceRegistryCounters({}),
      freshnessMinutes: null,
      signalCount: 0,
      parseCount: 0,
      failureCount: hasOpenTableApiKey ? 1 : 0,
      stale: false,
      confidence: confidenceFromLifecycle(hasOpenTableApiKey ? "degraded" : "disabled", 0, hasOpenTableApiKey ? 1 : 0),
      failureReason: hasOpenTableApiKey ? "Connector configured but parser not implemented" : "Credentials missing",
      debugNotes: [`missingEnvVars=${hasOpenTableApiKey ? "none" : "OPENTABLE_API_KEY"}`],
      notes: hasOpenTableApiKey ? ["Active, no matches this run"] : disabledCredentialNotes(["OPENTABLE_API_KEY"]),
      status: "yellow",
    },
    tock_metadata: {
      id: "tock_metadata",
      label: "Tock Metadata",
      category: "reservation",
      lifecycle: hasTockApiKey ? "degraded" : "disabled",
      statusDetail: hasTockApiKey ? "degraded" : "disabled_credentials_missing",
      enabled: hasTockApiKey,
      credentialRequirements: ["TOCK_API_KEY"],
      missingCredentials: hasTockApiKey ? [] : ["TOCK_API_KEY"],
      freshnessWindowMinutes: 24 * 60,
      lastAttemptedAt: null,
      lastSuccessfulAt: null,
      lastAttemptAt: null,
      lastSuccessAt: null,
      ...sourceRegistryCounters({}),
      freshnessMinutes: null,
      signalCount: 0,
      parseCount: 0,
      failureCount: hasTockApiKey ? 1 : 0,
      stale: false,
      confidence: confidenceFromLifecycle(hasTockApiKey ? "degraded" : "disabled", 0, hasTockApiKey ? 1 : 0),
      failureReason: hasTockApiKey ? "Connector configured but parser not implemented" : "Credentials missing",
      debugNotes: [`missingEnvVars=${hasTockApiKey ? "none" : "TOCK_API_KEY"}`],
      notes: hasTockApiKey ? ["Active, no matches this run"] : disabledCredentialNotes(["TOCK_API_KEY"]),
      status: "yellow",
    },
    tiktok_proxy: {
      id: "tiktok_proxy",
      label: "TikTok Proxy (manual)",
      category: "social_proxy",
      lifecycle: manualTiktokTagged > 0 ? "active" : "disabled",
      statusDetail: manualTiktokTagged > 0 ? "active" : "disabled_connector",
      enabled: manualTiktokTagged > 0,
      credentialRequirements: [],
      missingCredentials: [],
      freshnessWindowMinutes: manualTiktokTagged > 0 ? 14 * 24 * 60 : null,
      lastAttemptedAt: manualTiktokTagged > 0 ? data.lastUpdated || null : null,
      lastSuccessfulAt: manualTiktokTagged > 0 ? data.lastUpdated || null : null,
      lastAttemptAt: manualTiktokTagged > 0 ? data.lastUpdated || null : null,
      lastSuccessAt: manualTiktokTagged > 0 ? data.lastUpdated || null : null,
      ...sourceRegistryCounters({
        fetchedItems: manualTiktokTagged,
        normalizedArticles: manualTiktokTagged,
        candidateSignals: manualTiktokTagged,
        finalSignals: manualTiktokTagged,
      }),
      freshnessMinutes: manualTiktokTagged > 0 ? manualFreshness : null,
      signalCount: manualTiktokTagged,
      parseCount: manualTiktokTagged,
      failureCount: 0,
      stale: false,
      confidence: manualTiktokTagged > 0 ? 58 : 20,
      failureReason: manualTiktokTagged > 0 ? null : "Connector disabled",
      debugNotes: manualTiktokTagged > 0 ? [`manual_tiktok_tags=${manualTiktokTagged}`] : ["future/manual proxy only"],
      notes:
        manualTiktokTagged > 0
          ? ["Manual social proxy active (TikTok spotted tags)", "No scraping or direct API calls"]
          : ["Connector disabled", "No live pulls", "Future/manual proxy only (compliant API access required)"],
      status: "yellow",
    },
    instagram_proxy: {
      id: "instagram_proxy",
      label: "Instagram Proxy (manual)",
      category: "social_proxy",
      lifecycle: manualInstagramTagged > 0 ? "active" : "disabled",
      statusDetail: manualInstagramTagged > 0 ? "active" : "disabled_connector",
      enabled: manualInstagramTagged > 0,
      credentialRequirements: [],
      missingCredentials: [],
      freshnessWindowMinutes: manualInstagramTagged > 0 ? 14 * 24 * 60 : null,
      lastAttemptedAt: manualInstagramTagged > 0 ? data.lastUpdated || null : null,
      lastSuccessfulAt: manualInstagramTagged > 0 ? data.lastUpdated || null : null,
      lastAttemptAt: manualInstagramTagged > 0 ? data.lastUpdated || null : null,
      lastSuccessAt: manualInstagramTagged > 0 ? data.lastUpdated || null : null,
      ...sourceRegistryCounters({
        fetchedItems: manualInstagramTagged,
        normalizedArticles: manualInstagramTagged,
        candidateSignals: manualInstagramTagged,
        finalSignals: manualInstagramTagged,
      }),
      freshnessMinutes: manualInstagramTagged > 0 ? manualFreshness : null,
      signalCount: manualInstagramTagged,
      parseCount: manualInstagramTagged,
      failureCount: 0,
      stale: false,
      confidence: manualInstagramTagged > 0 ? 58 : 20,
      failureReason: manualInstagramTagged > 0 ? null : "Connector disabled",
      debugNotes:
        manualInstagramTagged > 0 ? [`manual_instagram_tags=${manualInstagramTagged}`] : ["future/manual proxy only"],
      notes:
        manualInstagramTagged > 0
          ? ["Manual social proxy active (IG spotted tags)", "No scraping or direct API calls"]
          : ["Connector disabled", "No live pulls", "Future/manual proxy only (compliant API access required)"],
      status: "yellow",
    },
  };

  for (const key of Object.keys(sources)) {
    const s = sources[key];
    s.status = sourceStatus({
      lifecycle: s.lifecycle,
      stale: s.stale,
      failureCount: s.failureCount,
      signalCount: s.signalCount,
    });
  }

  const storage = {
    foodTrendData: await storageHealthForTrends(nowMs),
    trendHistory: await storageHealthForHistory(nowMs),
  };

  const weeklyRefresh: JobHealth = {
    lastRunAt: data.refreshType === "weekly" ? data.lastUpdated || null : null,
    lastSuccessAt: data.refreshType === "weekly" ? data.lastUpdated || null : null,
    durationMs: null,
    status: jobStatus(data.refreshType === "weekly" ? data.lastUpdated || null : null, 9 * 24 * 60),
    errorMessage: null,
  };
  const weekendRefresh: JobHealth = {
    lastRunAt: data.refreshType === "weekend" ? data.lastUpdated || null : null,
    lastSuccessAt: data.refreshType === "weekend" ? data.lastUpdated || null : null,
    durationMs: null,
    status: jobStatus(data.refreshType === "weekend" ? data.lastUpdated || null : null, 4 * 24 * 60),
    errorMessage: null,
  };
  const redditPull: JobHealth = {
    lastRunAt: sources.reddit_communities.lastAttemptAt,
    lastSuccessAt: sources.reddit_communities.lastSuccessAt,
    durationMs: null,
    status: sources.reddit_communities.enabled
      ? (sources.reddit_communities.signalCount > 0 ? "green" : "yellow")
      : "yellow",
    errorMessage:
      sources.reddit_communities.enabled && sources.reddit_communities.signalCount === 0
        ? "no normalized reddit signals"
        : null,
  };
  const trendUpdate: JobHealth = {
    lastRunAt: data.lastUpdated || null,
    lastSuccessAt: data.lastUpdated || null,
    durationMs: null,
    status: jobStatus(data.lastUpdated || null, 3 * 24 * 60),
    errorMessage: null,
  };

  const jobs = { weeklyRefresh, weekendRefresh, redditPull, trendUpdate };
  const sourceValues = Object.values(sources);
  const sourceRed = sourceValues.filter((s) => s.status === "red").length;
  const anyStorageRed = Object.values(storage).some((s) => s.status === "red");
  const anyYellow =
    Object.values(jobs).some((j) => j.status === "yellow") ||
    sourceValues.some((s) => s.status === "yellow") ||
    Object.values(storage).some((s) => s.status === "yellow");

  const overallStatus: HealthStatus = anyStorageRed || sourceRed >= 2 || trendUpdate.status === "red"
    ? "red"
    : anyYellow || sourceRed === 1
      ? "yellow"
      : "green";

  return {
    generatedAt: nowIso,
    overallStatus,
    jobs,
    sources,
    storage,
  };
}
