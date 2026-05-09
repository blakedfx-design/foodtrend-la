import fs from "node:fs/promises";
import { LA_FOOD_TRENDS_DATA_FILE } from "@/lib/laFoodTrendsData";

type SnapshotTrend = {
  id: string;
  title: string;
  restaurantsKey: string;
  score: number | null;
};

export type TrendsAuditSnapshot = {
  totalCount: number;
  primaryCount: number;
  aboutToHitCount: number;
  titles: string[];
  byId: Record<string, SnapshotTrend>;
};

export type TrendsAuditDelta = {
  changedTitles: string[];
  changedRestaurants: string[];
  changedScores: string[];
  addedTrends: string[];
  removedTrends: string[];
};

type SourceContribution = {
  restaurantDiscovery: boolean;
  ranking: boolean;
  trendTitle: boolean;
  trendCopy: boolean;
  image: boolean;
  links: boolean;
  scoring: boolean;
  aboutToHit: boolean;
};

export type SourceInventoryItem = {
  source: string;
  enabled: boolean;
  type: "real_api" | "simulated" | "hardcoded" | "manual_seed" | "link_only";
  usedBy: string[];
  contribution: SourceContribution;
  notes: string;
};

export type EnvVarUsage = {
  name: string;
  usedIn: string[];
  required: boolean;
  optional: boolean;
  breaksWhenMissing: string;
};

export type ConnectorHealth = {
  connector: "google_places" | "reddit" | "listings" | "github_writeback" | "cron_auth";
  status: "red" | "yellow" | "green";
  ready: boolean;
  missingEnvVars: string[];
  contributes: string[];
  recommendedFix: string;
  lastKnownSuccessfulRun: string | null;
};

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function parseScore(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function trendRowsFromParsed(parsed: Record<string, unknown>): SnapshotTrend[] {
  const rows: SnapshotTrend[] = [];
  for (const key of ["trends", "aboutToHit"] as const) {
    const arr = parsed[key];
    if (!Array.isArray(arr)) continue;
    for (const el of arr) {
      if (!isRecord(el)) continue;
      const id = typeof el.id === "string" ? el.id.trim() : "";
      const title = typeof el.name === "string" ? el.name.trim() : "";
      if (!id || !title) continue;
      const restaurants = Array.isArray(el.restaurants)
        ? (el.restaurants as unknown[])
            .map((r) => {
              if (!isRecord(r)) return "";
              return typeof r.name === "string" ? r.name.trim() : "";
            })
            .filter(Boolean)
        : [];
      rows.push({
        id,
        title,
        restaurantsKey: restaurants.join(" | "),
        score: parseScore(el.signalScore),
      });
    }
  }
  return rows;
}

export function snapshotFromParsed(parsed: Record<string, unknown>): TrendsAuditSnapshot {
  const primary = Array.isArray(parsed.trends) ? parsed.trends.length : 0;
  const about = Array.isArray(parsed.aboutToHit) ? parsed.aboutToHit.length : 0;
  const rows = trendRowsFromParsed(parsed);
  const byId: Record<string, SnapshotTrend> = {};
  for (const r of rows) byId[r.id] = r;
  return {
    totalCount: primary + about,
    primaryCount: primary,
    aboutToHitCount: about,
    titles: rows.map((r) => r.title),
    byId,
  };
}

export function diffTrendSnapshots(
  before: TrendsAuditSnapshot,
  after: TrendsAuditSnapshot,
): TrendsAuditDelta {
  const ids = new Set([...Object.keys(before.byId), ...Object.keys(after.byId)]);
  const changedTitles: string[] = [];
  const changedRestaurants: string[] = [];
  const changedScores: string[] = [];
  const addedTrends: string[] = [];
  const removedTrends: string[] = [];

  for (const id of ids) {
    const b = before.byId[id];
    const a = after.byId[id];
    if (!b && a) {
      addedTrends.push(a.title);
      continue;
    }
    if (b && !a) {
      removedTrends.push(b.title);
      continue;
    }
    if (!b || !a) continue;
    if (b.title !== a.title) changedTitles.push(`${b.title} -> ${a.title}`);
    if (b.restaurantsKey !== a.restaurantsKey) changedRestaurants.push(a.title);
    if (b.score !== a.score) changedScores.push(a.title);
  }

  return { changedTitles, changedRestaurants, changedScores, addedTrends, removedTrends };
}

export function envPresenceFlags() {
  const hasRedditClient =
    Boolean(process.env.REDDIT_CLIENT_ID?.trim()) &&
    Boolean(process.env.REDDIT_CLIENT_SECRET?.trim()) &&
    Boolean(process.env.REDDIT_USER_AGENT?.trim());
  const hasRedditPasswordGrant =
    Boolean(process.env.REDDIT_USERNAME?.trim()) && Boolean(process.env.REDDIT_PASSWORD?.trim());
  return {
    hasCronSecret: Boolean(process.env.CRON_SECRET?.trim()),
    hasGooglePlacesKey: Boolean(process.env.GOOGLE_PLACES_API_KEY?.trim()),
    hasListingsSupplyKey: Boolean(
      process.env.LISTINGS_SUPPLY_API_KEY?.trim() ?? process.env.YELP_API_KEY?.trim(),
    ),
    hasGitHubWriteback:
      Boolean(process.env.GITHUB_TOKEN?.trim()) &&
      Boolean(process.env.GITHUB_OWNER?.trim()) &&
      Boolean(process.env.GITHUB_REPO?.trim()) &&
      Boolean(process.env.GITHUB_BRANCH?.trim()),
    hasRedditClient,
    hasRedditPasswordGrant,
    onVercel: Boolean(process.env.VERCEL),
    nodeEnv: process.env.NODE_ENV ?? "unknown",
  };
}

export function readinessFlags() {
  const env = envPresenceFlags();
  return {
    googlePlacesReady: env.hasGooglePlacesKey,
    redditReady: env.hasRedditClient,
    listingsReady: env.hasListingsSupplyKey,
    cronAuthReady: env.hasCronSecret,
    githubWritebackReady: env.hasGitHubWriteback,
  };
}

export function envVarUsageInventory(): EnvVarUsage[] {
  return [
    {
      name: "GOOGLE_PLACES_API_KEY",
      usedIn: ["lib/places.ts#requireGooglePlacesApiKey", "app/api/cron/weekend-refresh/route.ts"],
      required: true,
      optional: false,
      breaksWhenMissing: "Weekend refresh cannot run Google Places enrichment (503 on route).",
    },
    {
      name: "REDDIT_CLIENT_ID",
      usedIn: ["lib/sources/reddit.ts#redditClientCreds"],
      required: true,
      optional: false,
      breaksWhenMissing: "Reddit ingest/search returns empty signals.",
    },
    {
      name: "REDDIT_CLIENT_SECRET",
      usedIn: ["lib/sources/reddit.ts#redditClientCreds"],
      required: true,
      optional: false,
      breaksWhenMissing: "Reddit ingest/search returns empty signals.",
    },
    {
      name: "REDDIT_USER_AGENT",
      usedIn: ["lib/sources/reddit.ts#requireRedditUserAgent"],
      required: true,
      optional: false,
      breaksWhenMissing: "Reddit requests are skipped; ingest returns no usable data.",
    },
    {
      name: "REDDIT_USERNAME",
      usedIn: ["lib/sources/reddit.ts#redditUserCreds"],
      required: false,
      optional: true,
      breaksWhenMissing: "Password grant unavailable (falls back to client_credentials mode).",
    },
    {
      name: "REDDIT_PASSWORD",
      usedIn: ["lib/sources/reddit.ts#redditUserCreds"],
      required: false,
      optional: true,
      breaksWhenMissing: "Password grant unavailable (falls back to client_credentials mode).",
    },
    {
      name: "LISTINGS_SUPPLY_API_KEY",
      usedIn: ["lib/sources/listingsSupply.ts#listingsSupplyApiKey", "lib/weekendPlacesCron.ts"],
      required: false,
      optional: true,
      breaksWhenMissing: "Open-listings supply connector disabled unless YELP_API_KEY is set.",
    },
    {
      name: "YELP_API_KEY",
      usedIn: ["lib/sources/listingsSupply.ts#listingsSupplyApiKey", "lib/weekendPlacesCron.ts"],
      required: false,
      optional: true,
      breaksWhenMissing: "Open-listings supply connector disabled unless LISTINGS_SUPPLY_API_KEY is set.",
    },
    {
      name: "CRON_SECRET",
      usedIn: ["lib/cronAuth.ts#verifyCronRequest", "all /api/cron/* routes"],
      required: true,
      optional: false,
      breaksWhenMissing: "Cron routes reject requests as unauthorized.",
    },
    {
      name: "GITHUB_TOKEN",
      usedIn: ["lib/github-writeback.ts#requireGitHubConfig"],
      required: true,
      optional: false,
      breaksWhenMissing: "Writeback cannot commit data updates to repository.",
    },
    {
      name: "GITHUB_OWNER",
      usedIn: ["lib/github-writeback.ts#requireGitHubConfig"],
      required: true,
      optional: false,
      breaksWhenMissing: "Writeback cannot resolve target repository.",
    },
    {
      name: "GITHUB_REPO",
      usedIn: ["lib/github-writeback.ts#requireGitHubConfig"],
      required: true,
      optional: false,
      breaksWhenMissing: "Writeback cannot resolve target repository.",
    },
    {
      name: "GITHUB_BRANCH",
      usedIn: ["lib/github-writeback.ts#requireGitHubConfig"],
      required: true,
      optional: false,
      breaksWhenMissing: "Writeback cannot resolve branch ref for commit updates.",
    },
    {
      name: "GITHUB_TRENDS_PATH",
      usedIn: ["not currently used (path is hardcoded in lib/github-writeback.ts)"],
      required: false,
      optional: true,
      breaksWhenMissing: "No effect today; path is fixed to data/la-food-trends.json.",
    },
  ];
}

export function dataSourceModeSummary() {
  const flags = envPresenceFlags();
  return {
    servingDataMode: "runtime-read-from-repo-json",
    writebackMode: flags.hasGitHubWriteback ? "github-contents-api" : "no-github-writeback-configured",
    filesystemPersistence: flags.onVercel ? "ephemeral-serverless-fs" : "local-persistent-fs",
    vercelWriteAccess:
      flags.onVercel && !flags.hasGitHubWriteback
        ? "build-time/static-or-ephemeral-only"
        : flags.onVercel
          ? "github-writeback-enabled"
          : "local-dev-writeable",
  };
}

export function sourceInventory(): SourceInventoryItem[] {
  const flags = envPresenceFlags();
  const sharedFalse: SourceContribution = {
    restaurantDiscovery: false,
    ranking: false,
    trendTitle: false,
    trendCopy: false,
    image: false,
    links: false,
    scoring: false,
    aboutToHit: false,
  };
  return [
    {
      source: "Google Places",
      enabled: flags.hasGooglePlacesKey,
      type: "real_api",
      usedBy: ["lib/places.ts#searchPlaces", "lib/weekendPlacesCron.ts#applyWeekendGooglePlacesSignalsToParsed"],
      contribution: { ...sharedFalse, ranking: true, scoring: true, aboutToHit: true },
      notes: "Weekend cron recalculates signalScore/evidence from Places search results.",
    },
    {
      source: "Reddit",
      enabled: flags.hasRedditClient,
      type: "real_api",
      usedBy: ["lib/sources/reddit.ts", "app/api/cron/reddit/route.ts", "lib/weekendPlacesCron.ts"],
      contribution: {
        ...sharedFalse,
        restaurantDiscovery: true,
        ranking: true,
        scoring: true,
        aboutToHit: true,
      },
      notes: "Used both as standalone ingest and weekend score boost/evidence.",
    },
    {
      source: "Yelp Open Listings API",
      enabled: flags.hasListingsSupplyKey,
      type: "real_api",
      usedBy: ["lib/sources/listingsSupply.ts", "lib/weekendPlacesCron.ts"],
      contribution: { ...sharedFalse, restaurantDiscovery: true, ranking: true, scoring: true, aboutToHit: true },
      notes: "Aggregated listing supply signals via Yelp endpoint; no direct UI venue replacement.",
    },
    {
      source: "Instagram links",
      enabled: true,
      type: "link_only",
      usedBy: ["data/la-food-trends.json", "components/foodtrend/wherePick.ts"],
      contribution: { ...sharedFalse, links: true },
      notes: "Manual URLs in trend/restaurant rows; not API-ingested.",
    },
    {
      source: "TikTok links",
      enabled: true,
      type: "link_only",
      usedBy: ["data/la-food-trends.json", "types/socialSignal.ts"],
      contribution: { ...sharedFalse, links: true },
      notes: "Manual social signal URLs only; no automated TikTok extraction.",
    },
    {
      source: "Google Maps links",
      enabled: true,
      type: "manual_seed",
      usedBy: ["data/la-food-trends.json", "lib/updateTrendsSimulation.ts", "lib/whereShowing.ts"],
      contribution: { ...sharedFalse, links: true },
      notes: "Static outbound map links attached to restaurants.",
    },
    {
      source: "Manual trend seeds (repo JSON)",
      enabled: true,
      type: "manual_seed",
      usedBy: ["data/la-food-trends.json", "lib/whereShowing.ts"],
      contribution: {
        ...sharedFalse,
        restaurantDiscovery: true,
        trendTitle: true,
        trendCopy: true,
        image: true,
        links: true,
        ranking: true,
        scoring: true,
        aboutToHit: true,
      },
      notes: "Primary source of visible content served by pages.",
    },
    {
      source: "Simulation generator",
      enabled: true,
      type: "simulated",
      usedBy: ["lib/updateTrendsSimulation.ts", "scripts/update-trends.ts"],
      contribution: {
        ...sharedFalse,
        restaurantDiscovery: true,
        trendTitle: true,
        trendCopy: true,
        image: true,
        links: true,
        ranking: true,
        scoring: true,
        aboutToHit: true,
      },
      notes: "Hardcoded fallback/simulation data for rebuilds and scripted refreshes.",
    },
    {
      source: "Yelp editorial image credit",
      enabled: true,
      type: "hardcoded",
      usedBy: ["data/la-food-trends.json", "lib/updateTrendsSimulation.ts"],
      contribution: { ...sharedFalse, image: true },
      notes: "Manual image attribution only; no live Yelp media ingestion.",
    },
    {
      source: "Eater LA",
      enabled: false,
      type: "hardcoded",
      usedBy: [],
      contribution: sharedFalse,
      notes: "No active ingestion/parser in codebase.",
    },
    {
      source: "The Infatuation",
      enabled: false,
      type: "hardcoded",
      usedBy: [],
      contribution: sharedFalse,
      notes: "No active ingestion/parser in codebase.",
    },
    {
      source: "LA Times Food",
      enabled: false,
      type: "hardcoded",
      usedBy: [],
      contribution: sharedFalse,
      notes: "No active ingestion/parser in codebase.",
    },
    {
      source: "Resy",
      enabled: false,
      type: "hardcoded",
      usedBy: [],
      contribution: sharedFalse,
      notes: "No reservation API ingestion currently configured.",
    },
    {
      source: "OpenTable",
      enabled: false,
      type: "hardcoded",
      usedBy: [],
      contribution: sharedFalse,
      notes: "No reservation API ingestion currently configured.",
    },
  ];
}

export function connectorHealthSummary(lastUpdated: string | null, refreshType: string | null): ConnectorHealth[] {
  const env = envPresenceFlags();
  const ready = readinessFlags();
  const weekendLastKnown = refreshType === "weekend" ? lastUpdated : null;
  const cronAndWritebackReady = env.hasCronSecret && env.hasGitHubWriteback;
  const writebackLastKnown = refreshType === "weekly" || refreshType === "weekend" ? lastUpdated : null;

  return [
    {
      connector: "google_places",
      status: ready.googlePlacesReady ? "green" : "red",
      ready: ready.googlePlacesReady,
      missingEnvVars: ready.googlePlacesReady ? [] : ["GOOGLE_PLACES_API_KEY"],
      contributes: ["ranking", "scoring", "evidenceSummary", "aboutToHit scoring"],
      recommendedFix: "Set GOOGLE_PLACES_API_KEY in Vercel Project Settings -> Environment Variables.",
      lastKnownSuccessfulRun: weekendLastKnown,
    },
    {
      connector: "reddit",
      status: ready.redditReady ? "green" : "red",
      ready: ready.redditReady,
      missingEnvVars: ready.redditReady
        ? []
        : ["REDDIT_CLIENT_ID", "REDDIT_CLIENT_SECRET", "REDDIT_USER_AGENT"],
      contributes: ["discussion velocity", "momentum boost", "social evidence"],
      recommendedFix:
        "Set REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_USER_AGENT (optional REDDIT_USERNAME/REDDIT_PASSWORD for password grant).",
      lastKnownSuccessfulRun: weekendLastKnown,
    },
    {
      connector: "listings",
      status: ready.listingsReady ? "green" : "red",
      ready: ready.listingsReady,
      missingEnvVars: ready.listingsReady ? [] : ["LISTINGS_SUPPLY_API_KEY or YELP_API_KEY"],
      contributes: ["restaurant supply coverage", "neighborhood clustering", "score boost"],
      recommendedFix: "Set LISTINGS_SUPPLY_API_KEY (preferred) or YELP_API_KEY.",
      lastKnownSuccessfulRun: weekendLastKnown,
    },
    {
      connector: "github_writeback",
      status: ready.githubWritebackReady ? "green" : "red",
      ready: ready.githubWritebackReady,
      missingEnvVars: ready.githubWritebackReady
        ? []
        : ["GITHUB_TOKEN", "GITHUB_OWNER", "GITHUB_REPO", "GITHUB_BRANCH"],
      contributes: ["persisting updated trend JSON for live page"],
      recommendedFix: "Set full GitHub writeback variables and ensure token has repo write access.",
      lastKnownSuccessfulRun: writebackLastKnown,
    },
    {
      connector: "cron_auth",
      status: ready.cronAuthReady ? (ready.githubWritebackReady ? "green" : "yellow") : "red",
      ready: ready.cronAuthReady,
      missingEnvVars: ready.cronAuthReady ? [] : ["CRON_SECRET"],
      contributes: ["secure cron route invocation"],
      recommendedFix: "Set CRON_SECRET and ensure scheduled jobs send Authorization: Bearer <CRON_SECRET>.",
      lastKnownSuccessfulRun: cronAndWritebackReady ? writebackLastKnown : null,
    },
  ];
}

export async function readParsedTrendsJsonFromDisk(): Promise<Record<string, unknown> | null> {
  try {
    const raw = await fs.readFile(LA_FOOD_TRENDS_DATA_FILE, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
