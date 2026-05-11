import { normalizeEntity } from "@/lib/signals/normalizeEntity";
import {
  buildEditorialLexicon,
  type EditorialLexiconCategory,
} from "@/lib/signals/editorialLexicon";
import type { SignalSource, TrendSignal } from "@/lib/signals/types";
import type { LaFoodTrendsDataFile, Trend } from "@/types/laFoodTrend";

type PublicationSource =
  | "eater"
  | "infatuation"
  | "latimes"
  | "resy_la"
  | "timeout_la"
  | "bonappetit";

type FeedConfig = {
  source: PublicationSource;
  feedUrl: string;
};

type EditorialArticle = {
  source: PublicationSource;
  title: string;
  link: string;
  publishedAt: string;
  subhead: string;
};

export type EditorialFeedDiagnostic = {
  source: PublicationSource;
  url: string;
  statusCode: number | null;
  contentType: string | null;
  responseByteLength: number;
  responsePreview: string;
  parserMode: "rss" | "atom" | "json" | "html_fallback" | "unknown";
  rawItemCount: number;
  parsedArticleCount: number;
  sampleTitles: string[];
  first10Titles: string[];
  failureReason: string | null;
  parseDiagnostics: {
    candidateItemCount: number;
    droppedMissingTitle: number;
    droppedMissingLink: number;
    droppedCdataTitleLikely: number;
  };
  sourceDiagnostics: {
    fetchedItems: number;
    laRelevantItems: number;
    normalizedArticles: number;
    rejectedItems: number;
    rejectReasons: Record<string, number>;
  };
  fetchedAt: string;
};

type LexiconEntityType = "dish" | "restaurant" | "cuisine" | "ingredient";
type LexiconOrigin = "trend_title" | "menu_item" | "restaurant" | "cuisine_seed" | "candidate_term";

type LexiconEntry = {
  entity: string;
  normalized: string;
  entityType: LexiconEntityType;
  category: EditorialLexiconCategory;
  origin: LexiconOrigin;
  candidateOnly: boolean;
  trendId: string;
  restaurants: string[];
  neighborhoods: string[];
  aboutToHit: boolean;
};

type IgnoredGenericMatch = {
  publication: PublicationSource;
  articleTitle: string;
  matchedPhrase: string;
  matchedCategory: EditorialLexiconCategory;
  reason: string;
};

type SuppressedNeighborhoodCandidate = {
  publication: PublicationSource;
  articleTitle: string;
  matchedPhrase: string;
  reason: string;
};

export type EditorialIngestionStats = {
  scannedBySource: Record<PublicationSource, number>;
  scannedTotal: number;
  entitiesExtracted: number;
  overlapEntities: Array<{ entity: string; sources: PublicationSource[] }>;
  topEntities: Array<{ entity: string; mentions: number }>;
  candidateOnlyTopEntities: Array<{ entity: string; mentions: number }>;
  topDishCandidates: Array<{ entity: string; mentions: number }>;
  topFormatCandidates: Array<{ entity: string; mentions: number }>;
  topIngredientCandidates: Array<{ entity: string; mentions: number }>;
  neighborhoodMentionsAttached: number;
  suppressedNeighborhoodCandidates: SuppressedNeighborhoodCandidate[];
  ignoredGenericMatches: IgnoredGenericMatch[];
  failedSources: PublicationSource[];
  sourceSignalFunnel: Record<
    PublicationSource,
    {
      fetchedItems: number;
      laRelevantItems: number;
      normalizedArticles: number;
      articlesWithExtractableEntities: number;
      extractedEntities: number;
      candidateSignals: number;
      candidateTrends: number;
      finalSignals: number;
      rejectedByRelevance: number;
      rejectedByCategory: number;
      rejectedByConfidence: number;
      rejectedByDeduplication: number;
      rejectedItems: number;
      rejectReasons: Record<string, number>;
    }
  >;
};

const FEED_CONFIGS: FeedConfig[] = [
  { source: "eater", feedUrl: "https://la.eater.com/rss/index.xml" },
  { source: "infatuation", feedUrl: "https://www.theinfatuation.com/los-angeles/feed" },
  { source: "latimes", feedUrl: "https://www.latimes.com/food/rss2.0.xml" },
  { source: "resy_la", feedUrl: "https://blog.resy.com/city/los-angeles/feed/" },
  { source: "timeout_la", feedUrl: "https://www.timeout.com/los-angeles/restaurants" },
  { source: "bonappetit", feedUrl: "https://www.bonappetit.com/feed/rss" },
];

const EDITORIAL_SOURCE_WEIGHTS: Record<PublicationSource, number> = {
  eater: 0.25,
  infatuation: 0.22,
  latimes: 0.3,
  resy_la: 0.2,
  timeout_la: 0.2,
  bonappetit: 0.19,
};

const FEED_CACHE_TTL_MS = 15 * 60 * 1000;
const FEED_TIMEOUT_MS = 5500;
const MAX_ARTICLES_PER_SOURCE = 20;
const MAX_TOP_ENTITIES = 8;

const feedCache = new Map<string, { expiresAt: number; articles: EditorialArticle[] }>();
const feedDiagnosticsCache = new Map<
  string,
  { expiresAt: number; diagnostic: EditorialFeedDiagnostic; articles: EditorialArticle[] }
>();
const articleRelevanceCache = new Map<string, { expiresAt: number; keep: boolean; reason: string }>();
let lastIngestionStats: EditorialIngestionStats = {
  scannedBySource: {
    eater: 0,
    infatuation: 0,
    latimes: 0,
    resy_la: 0,
    timeout_la: 0,
    bonappetit: 0,
  },
  scannedTotal: 0,
  entitiesExtracted: 0,
  overlapEntities: [],
  topEntities: [],
  candidateOnlyTopEntities: [],
  topDishCandidates: [],
  topFormatCandidates: [],
  topIngredientCandidates: [],
  neighborhoodMentionsAttached: 0,
  suppressedNeighborhoodCandidates: [],
  ignoredGenericMatches: [],
  failedSources: [],
  sourceSignalFunnel: {
    eater: {
      fetchedItems: 0,
      laRelevantItems: 0,
      normalizedArticles: 0,
      articlesWithExtractableEntities: 0,
      extractedEntities: 0,
      candidateSignals: 0,
      candidateTrends: 0,
      finalSignals: 0,
      rejectedByRelevance: 0,
      rejectedByCategory: 0,
      rejectedByConfidence: 0,
      rejectedByDeduplication: 0,
      rejectedItems: 0,
      rejectReasons: {},
    },
    infatuation: {
      fetchedItems: 0,
      laRelevantItems: 0,
      normalizedArticles: 0,
      articlesWithExtractableEntities: 0,
      extractedEntities: 0,
      candidateSignals: 0,
      candidateTrends: 0,
      finalSignals: 0,
      rejectedByRelevance: 0,
      rejectedByCategory: 0,
      rejectedByConfidence: 0,
      rejectedByDeduplication: 0,
      rejectedItems: 0,
      rejectReasons: {},
    },
    latimes: {
      fetchedItems: 0,
      laRelevantItems: 0,
      normalizedArticles: 0,
      articlesWithExtractableEntities: 0,
      extractedEntities: 0,
      candidateSignals: 0,
      candidateTrends: 0,
      finalSignals: 0,
      rejectedByRelevance: 0,
      rejectedByCategory: 0,
      rejectedByConfidence: 0,
      rejectedByDeduplication: 0,
      rejectedItems: 0,
      rejectReasons: {},
    },
    resy_la: {
      fetchedItems: 0,
      laRelevantItems: 0,
      normalizedArticles: 0,
      articlesWithExtractableEntities: 0,
      extractedEntities: 0,
      candidateSignals: 0,
      candidateTrends: 0,
      finalSignals: 0,
      rejectedByRelevance: 0,
      rejectedByCategory: 0,
      rejectedByConfidence: 0,
      rejectedByDeduplication: 0,
      rejectedItems: 0,
      rejectReasons: {},
    },
    timeout_la: {
      fetchedItems: 0,
      laRelevantItems: 0,
      normalizedArticles: 0,
      articlesWithExtractableEntities: 0,
      extractedEntities: 0,
      candidateSignals: 0,
      candidateTrends: 0,
      finalSignals: 0,
      rejectedByRelevance: 0,
      rejectedByCategory: 0,
      rejectedByConfidence: 0,
      rejectedByDeduplication: 0,
      rejectedItems: 0,
      rejectReasons: {},
    },
    bonappetit: {
      fetchedItems: 0,
      laRelevantItems: 0,
      normalizedArticles: 0,
      articlesWithExtractableEntities: 0,
      extractedEntities: 0,
      candidateSignals: 0,
      candidateTrends: 0,
      finalSignals: 0,
      rejectedByRelevance: 0,
      rejectedByCategory: 0,
      rejectedByConfidence: 0,
      rejectedByDeduplication: 0,
      rejectedItems: 0,
      rejectReasons: {},
    },
  },
};

function trendRestaurants(trend: Trend): string[] {
  return trend.restaurants.map((r) => r.name.trim()).filter(Boolean);
}

function trendNeighborhoods(trend: Trend): string[] {
  return trend.neighborhoods.map((n) => n.trim()).filter(Boolean);
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

const LA_RELEVANCE_HINT =
  /\b(los angeles|la\b|southern california|socal|dtla|koreatown|silver lake|echo park|pasadena|venice|santa monica|west hollywood|arts district|highland park|culver city|sawtelle|thai town|boyle heights|fairfax|inglewood|long beach)\b/i;
const BON_APPETIT_LA_RESTAURANT_HINT =
  /\b(holbox|bestia|bavel|gjelina|jon\s*&\s*vinny'?s|saffy'?s|anajak thai|pijja palace|republique|night\s*\+\s*market|found oyster|sushi\s+note|birdie\s*g'?s)\b/i;

type SourceFilterDecision = {
  keep: boolean;
  reason: string;
};

function evaluateSourceFilter(source: PublicationSource, article: EditorialArticle): SourceFilterDecision {
  if (source !== "bonappetit") return { keep: true, reason: "accepted_default" };
  const blob = `${article.title} ${article.subhead} ${article.link}`.toLowerCase();
  if (LA_RELEVANCE_HINT.test(blob)) return { keep: true, reason: "accepted_la_text_match" };
  if (BON_APPETIT_LA_RESTAURANT_HINT.test(blob)) return { keep: true, reason: "accepted_la_restaurant_match" };
  return { keep: false, reason: "rejected_not_la_relevant" };
}

function absoluteUrl(url: string, baseUrl: string): string {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  try {
    return new URL(url, baseUrl).toString();
  } catch {
    return "";
  }
}

async function bonAppetitBodyRelevance(article: EditorialArticle): Promise<SourceFilterDecision> {
  const cacheKey = article.link;
  const cached = articleRelevanceCache.get(cacheKey);
  const now = Date.now();
  if (cached && cached.expiresAt > now) return { keep: cached.keep, reason: cached.reason };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4500);
  try {
    const res = await fetch(article.link, {
      signal: controller.signal,
      cache: "no-store",
      headers: {
        "User-Agent": "FoodTrendLA-EditorialSignals/1.0 (+https://foodtrend-la.vercel.app)",
        Accept: "text/html",
      },
    });
    if (!res.ok) {
      const out = { keep: false, reason: `rejected_article_fetch_http_${res.status}` };
      articleRelevanceCache.set(cacheKey, { ...out, expiresAt: now + FEED_CACHE_TTL_MS });
      return out;
    }
    const body = await res.text();
    const bodyText = stripHtml(body).toLowerCase();
    const keep =
      LA_RELEVANCE_HINT.test(bodyText) || BON_APPETIT_LA_RESTAURANT_HINT.test(bodyText);
    const out = {
      keep,
      reason: keep ? "accepted_la_body_match" : "rejected_not_la_relevant",
    };
    articleRelevanceCache.set(cacheKey, { ...out, expiresAt: now + FEED_CACHE_TTL_MS });
    return out;
  } catch {
    const out = { keep: false, reason: "rejected_article_fetch_failed" };
    articleRelevanceCache.set(cacheKey, { ...out, expiresAt: now + FEED_CACHE_TTL_MS });
    return out;
  } finally {
    clearTimeout(timer);
  }
}

function unwrapCdata(input: string): string {
  return input.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1");
}

function stripHtml(input: string): string {
  const cdataSafe = unwrapCdata(input);
  return decodeHtmlEntities(cdataSafe.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

function sanitizePreview(text: string, maxLen = 300): string {
  return text.replace(/\s+/g, " ").replace(/[^\x20-\x7E]/g, "").trim().slice(0, maxLen);
}

function safeNormalize(value: string): string {
  return normalizeEntity(value).trim();
}

function normalizedContains(haystack: string, needle: string): boolean {
  if (!needle || !haystack) return false;
  if (needle.length < 4) return false;
  const paddedHaystack = ` ${haystack} `;
  return paddedHaystack.includes(` ${needle} `);
}

function parseRssItems(xml: string, source: PublicationSource): EditorialArticle[] {
  return parseRssItemsWithDiagnostics(xml, source).articles;
}

function parseRssItemsWithDiagnostics(
  xml: string,
  source: PublicationSource,
): {
  articles: EditorialArticle[];
  candidateItemCount: number;
  droppedMissingTitle: number;
  droppedMissingLink: number;
  droppedCdataTitleLikely: number;
} {
  const out: EditorialArticle[] = [];
  const items = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];
  let droppedMissingTitle = 0;
  let droppedMissingLink = 0;
  let droppedCdataTitleLikely = 0;
  for (const item of items) {
    const rawTitle = item.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? "";
    const title = stripHtml(item.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? "");
    const link = stripHtml(item.match(/<link>([\s\S]*?)<\/link>/i)?.[1] ?? "");
    const publishedAt = stripHtml(item.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1] ?? "");
    const descriptionRaw =
      item.match(/<description>([\s\S]*?)<\/description>/i)?.[1] ??
      item.match(/<content:encoded>([\s\S]*?)<\/content:encoded>/i)?.[1] ??
      "";
    const subhead = stripHtml(descriptionRaw);
    if (!title) {
      droppedMissingTitle += 1;
      if (rawTitle.includes("<![CDATA[")) droppedCdataTitleLikely += 1;
    }
    if (!link) droppedMissingLink += 1;
    if (!title || !link) continue;
    out.push({ source, title, link, publishedAt, subhead });
  }
  return {
    articles: out.slice(0, MAX_ARTICLES_PER_SOURCE),
    candidateItemCount: items.length,
    droppedMissingTitle,
    droppedMissingLink,
    droppedCdataTitleLikely,
  };
}

function parseAtomEntries(xml: string, source: PublicationSource): EditorialArticle[] {
  return parseAtomEntriesWithDiagnostics(xml, source).articles;
}

function parseAtomEntriesWithDiagnostics(
  xml: string,
  source: PublicationSource,
): {
  articles: EditorialArticle[];
  candidateItemCount: number;
  droppedMissingTitle: number;
  droppedMissingLink: number;
  droppedCdataTitleLikely: number;
} {
  const out: EditorialArticle[] = [];
  const entries = xml.match(/<entry\b[\s\S]*?<\/entry>/gi) ?? [];
  let droppedMissingTitle = 0;
  let droppedMissingLink = 0;
  let droppedCdataTitleLikely = 0;
  for (const entry of entries) {
    const rawTitle = entry.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "";
    const title = stripHtml(rawTitle);
    const link =
      stripHtml(entry.match(/<link[^>]*href=["']([^"']+)["'][^>]*\/?>/i)?.[1] ?? "") ||
      stripHtml(entry.match(/<id>([\s\S]*?)<\/id>/i)?.[1] ?? "");
    const publishedAt =
      stripHtml(entry.match(/<updated>([\s\S]*?)<\/updated>/i)?.[1] ?? "") ||
      stripHtml(entry.match(/<published>([\s\S]*?)<\/published>/i)?.[1] ?? "");
    const subheadRaw =
      entry.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i)?.[1] ??
      entry.match(/<content[^>]*>([\s\S]*?)<\/content>/i)?.[1] ??
      "";
    const subhead = stripHtml(subheadRaw);
    if (!title) {
      droppedMissingTitle += 1;
      if (rawTitle.includes("<![CDATA[")) droppedCdataTitleLikely += 1;
    }
    if (!link) droppedMissingLink += 1;
    if (!title || !link) continue;
    out.push({ source, title, link, publishedAt, subhead });
  }
  return {
    articles: out.slice(0, MAX_ARTICLES_PER_SOURCE),
    candidateItemCount: entries.length,
    droppedMissingTitle,
    droppedMissingLink,
    droppedCdataTitleLikely,
  };
}

function parseFeedItems(xml: string, source: PublicationSource): EditorialArticle[] {
  const rssItems = parseRssItems(xml, source);
  if (rssItems.length > 0) return rssItems;
  return parseAtomEntries(xml, source);
}

function detectParserMode(text: string, contentType: string | null): EditorialFeedDiagnostic["parserMode"] {
  const ct = (contentType ?? "").toLowerCase();
  const body = text.toLowerCase();
  if (ct.includes("json") || body.startsWith("{") || body.startsWith("[")) return "json";
  if (body.includes("<rss") || body.includes("<item")) return "rss";
  if (body.includes("<feed") || body.includes("<entry")) return "atom";
  if (body.includes("<html")) return "html_fallback";
  return "unknown";
}

function rawItemCountForMode(
  text: string,
  mode: EditorialFeedDiagnostic["parserMode"],
): number {
  if (mode === "rss") return (text.match(/<item\b/gi) ?? []).length;
  if (mode === "atom") return (text.match(/<entry\b/gi) ?? []).length;
  if (mode === "json") {
    try {
      const parsed = JSON.parse(text) as unknown;
      if (Array.isArray(parsed)) return parsed.length;
      if (parsed && typeof parsed === "object") {
        const obj = parsed as Record<string, unknown>;
        if (Array.isArray(obj.items)) return obj.items.length;
        if (Array.isArray(obj.articles)) return obj.articles.length;
      }
      return 0;
    } catch {
      return 0;
    }
  }
  return (text.match(/<article\b/gi) ?? []).length;
}

function parseTimeoutHtmlArticles(html: string): {
  articles: EditorialArticle[];
  candidateItemCount: number;
  rejectReasons: Record<string, number>;
} {
  const cards =
    html.match(/<article\b[\s\S]*?<\/article>/gi) ??
    html.match(/<li\b[^>]*class="[^"]*(?:tile|card|feature-item)[^"]*"[\s\S]*?<\/li>/gi) ??
    [];
  const out: EditorialArticle[] = [];
  const rejectReasons: Record<string, number> = {};
  for (const card of cards) {
    const titleRaw =
      card.match(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/i)?.[1] ??
      card.match(/<a[^>]*>([\s\S]*?)<\/a>/i)?.[1] ??
      "";
    const title = stripHtml(titleRaw);
    const hrefRaw = card.match(/<a[^>]*href=["']([^"']+)["']/i)?.[1] ?? "";
    const link = absoluteUrl(stripHtml(hrefRaw), "https://www.timeout.com");
    const subheadRaw =
      card.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1] ??
      card.match(/<div[^>]*class="[^"]*excerpt[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ??
      "";
    const subhead = stripHtml(subheadRaw);
    const publishedAt =
      stripHtml(card.match(/<time[^>]*datetime=["']([^"']+)["']/i)?.[1] ?? "") ||
      stripHtml(card.match(/<time[^>]*>([\s\S]*?)<\/time>/i)?.[1] ?? "");
    if (!title) {
      rejectReasons["missing_title"] = (rejectReasons["missing_title"] ?? 0) + 1;
      continue;
    }
    if (!link) {
      rejectReasons["missing_link"] = (rejectReasons["missing_link"] ?? 0) + 1;
      continue;
    }
    out.push({ source: "timeout_la", title, link, publishedAt, subhead });
  }
  return { articles: out.slice(0, MAX_ARTICLES_PER_SOURCE), candidateItemCount: cards.length, rejectReasons };
}

async function fetchTextWithMeta(url: string): Promise<{
  statusCode: number | null;
  contentType: string | null;
  text: string;
  byteLength: number;
}> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FEED_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
      headers: {
        "User-Agent": "FoodTrendLA-EditorialSignals/1.0 (+https://foodtrend-la.vercel.app)",
        Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, text/html",
      },
    });
    const text = await res.text();
    return {
      statusCode: res.status,
      contentType: res.headers.get("content-type"),
      byteLength: Buffer.byteLength(text, "utf-8"),
      text: res.ok ? text : "",
    };
  } catch {
    return { statusCode: null, contentType: null, text: "", byteLength: 0 };
  } finally {
    clearTimeout(timer);
  }
}

function parseArticlesByMode(
  source: PublicationSource,
  text: string,
  mode: EditorialFeedDiagnostic["parserMode"],
): {
  articles: EditorialArticle[];
  candidateItemCount: number;
  droppedMissingTitle: number;
  droppedMissingLink: number;
  droppedCdataTitleLikely: number;
  rejectReasons?: Record<string, number>;
} {
  if (mode === "rss") return parseRssItemsWithDiagnostics(text, source);
  if (mode === "atom") return parseAtomEntriesWithDiagnostics(text, source);
  if (mode === "html_fallback" && source === "timeout_la") {
    const parsed = parseTimeoutHtmlArticles(text);
    return {
      articles: parsed.articles,
      candidateItemCount: parsed.candidateItemCount,
      droppedMissingTitle: 0,
      droppedMissingLink: 0,
      droppedCdataTitleLikely: 0,
      rejectReasons: parsed.rejectReasons,
    };
  }
  const parsed = parseFeedItems(text, source);
  return {
    articles: parsed,
    candidateItemCount: rawItemCountForMode(text, mode),
    droppedMissingTitle: 0,
    droppedMissingLink: 0,
    droppedCdataTitleLikely: 0,
  };
}

function deriveFailureReason(
  source: PublicationSource,
  statusCode: number | null,
  parserMode: EditorialFeedDiagnostic["parserMode"],
  rawItemCount: number,
  parsedArticleCount: number,
  responseByteLength: number,
  droppedMissingTitle: number,
  droppedCdataTitleLikely: number,
): string | null {
  if (statusCode == null) return "network-error-or-timeout";
  if (statusCode >= 400) return `http-${statusCode}`;
  if (source === "timeout_la") return null;
  if (responseByteLength === 0) return "empty-response-body";
  if (rawItemCount === 0 && parserMode === "html_fallback") return "html-response-no-rss-or-atom-items";
  if (rawItemCount === 0 && parserMode === "json") return "json-feed-without-supported-items";
  if (rawItemCount === 0) return "no-feed-items-detected";
  if (parsedArticleCount === 0 && droppedMissingTitle > 0 && droppedCdataTitleLikely > 0) {
    return "title-normalization-dropped-cdata-title-content";
  }
  if (parsedArticleCount === 0) return "items-detected-but-article-normalization-yielded-zero";
  return null;
}

async function fetchFeedArticles(config: FeedConfig): Promise<EditorialArticle[]> {
  const key = `${config.source}:${config.feedUrl}`;
  const cached = feedCache.get(key);
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.articles;
  const { text, statusCode, contentType, byteLength } = await fetchTextWithMeta(config.feedUrl);
  const parserMode = detectParserMode(text.trimStart(), contentType);
  const parsed = text
    ? parseArticlesByMode(config.source, text, parserMode)
    : {
        articles: [],
        candidateItemCount: 0,
        droppedMissingTitle: 0,
        droppedMissingLink: 0,
        droppedCdataTitleLikely: 0,
      };
  const rawItemCount = parsed.candidateItemCount;
  const filteredDecisions = await Promise.all(
    parsed.articles.map(async (article) => {
      const initialDecision = evaluateSourceFilter(config.source, article);
      if (config.source !== "bonappetit" || initialDecision.keep) {
        return { article, decision: initialDecision };
      }
      const bodyDecision = await bonAppetitBodyRelevance(article);
      return { article, decision: bodyDecision };
    }),
  );
  const laRelevantItems = filteredDecisions.filter((row) => row.decision.keep).length;
  const rejectedByFilter = filteredDecisions.length - laRelevantItems;
  const rejectReasons: Record<string, number> = { ...(parsed.rejectReasons ?? {}) };
  for (const row of filteredDecisions) {
    if (row.decision.keep) continue;
    rejectReasons[row.decision.reason] = (rejectReasons[row.decision.reason] ?? 0) + 1;
  }
  const articles = filteredDecisions
    .filter((row) => row.decision.keep)
    .map((row) => row.article);
  const sourceDiagnostics = {
    fetchedItems: rawItemCount,
    laRelevantItems,
    normalizedArticles: articles.length,
    rejectedItems: rejectedByFilter + Object.values(parsed.rejectReasons ?? {}).reduce((sum, v) => sum + v, 0),
    rejectReasons,
  };
  const diagnostic: EditorialFeedDiagnostic = {
    source: config.source,
    url: config.feedUrl,
    statusCode,
    contentType,
    responseByteLength: byteLength,
    responsePreview: sanitizePreview(text),
    parserMode,
    rawItemCount,
    parsedArticleCount: articles.length,
    sampleTitles: articles.slice(0, 3).map((a) => a.title),
    first10Titles: articles.slice(0, 10).map((a) => a.title),
    failureReason: deriveFailureReason(
      config.source,
      statusCode,
      parserMode,
      rawItemCount,
      articles.length,
      byteLength,
      parsed.droppedMissingTitle,
      parsed.droppedCdataTitleLikely,
    ),
    parseDiagnostics: {
      candidateItemCount: parsed.candidateItemCount,
      droppedMissingTitle: parsed.droppedMissingTitle,
      droppedMissingLink: parsed.droppedMissingLink,
      droppedCdataTitleLikely: parsed.droppedCdataTitleLikely,
    },
    sourceDiagnostics,
    fetchedAt: new Date().toISOString(),
  };
  feedCache.set(key, { articles, expiresAt: now + FEED_CACHE_TTL_MS });
  feedDiagnosticsCache.set(key, {
    diagnostic,
    articles,
    expiresAt: now + FEED_CACHE_TTL_MS,
  });
  return articles;
}

export async function getEditorialFeedDiagnostics(): Promise<EditorialFeedDiagnostic[]> {
  const rows = await Promise.all(
    FEED_CONFIGS.map(async (config) => {
      const key = `${config.source}:${config.feedUrl}`;
      const cached = feedDiagnosticsCache.get(key);
      const now = Date.now();
      if (cached && cached.expiresAt > now) return cached.diagnostic;
      await fetchFeedArticles(config);
      const refreshed = feedDiagnosticsCache.get(key);
      if (refreshed) return refreshed.diagnostic;
      return {
        source: config.source,
        url: config.feedUrl,
        statusCode: null,
        contentType: null,
        responseByteLength: 0,
        responsePreview: "",
        parserMode: "unknown",
        rawItemCount: 0,
        parsedArticleCount: 0,
        sampleTitles: [],
        first10Titles: [],
        failureReason: "diagnostic-cache-miss",
        parseDiagnostics: {
          candidateItemCount: 0,
          droppedMissingTitle: 0,
          droppedMissingLink: 0,
          droppedCdataTitleLikely: 0,
        },
        sourceDiagnostics: {
          fetchedItems: 0,
          laRelevantItems: 0,
          normalizedArticles: 0,
          rejectedItems: 0,
          rejectReasons: {},
        },
        fetchedAt: new Date().toISOString(),
      } as EditorialFeedDiagnostic;
    }),
  );
  return rows;
}

function addLexiconEntry(bucket: Map<string, LexiconEntry>, entry: LexiconEntry): void {
  if (!entry.entity || !entry.normalized) return;
  if (entry.normalized.length < 4) return;
  const existing = bucket.get(entry.normalized);
  if (!existing) {
    bucket.set(entry.normalized, entry);
    return;
  }
  const restaurants = [...new Set([...existing.restaurants, ...entry.restaurants])];
  const neighborhoods = [...new Set([...existing.neighborhoods, ...entry.neighborhoods])];
  bucket.set(entry.normalized, {
    ...existing,
    category: existing.category,
    origin: existing.origin,
    candidateOnly: existing.candidateOnly && entry.candidateOnly,
    restaurants,
    neighborhoods,
    aboutToHit: existing.aboutToHit || entry.aboutToHit,
  });
}

function buildLexicon(data: LaFoodTrendsDataFile): {
  entries: LexiconEntry[];
  neighborhoodTerms: string[];
  genericSingleWordTerms: Set<string>;
} {
  const lexicon = new Map<string, LexiconEntry>();
  const neighborhoodSet = new Set<string>();
  const allRows: Array<{ trend: Trend; aboutToHit: boolean }> = [
    ...data.trends.map((trend) => ({ trend, aboutToHit: false })),
    ...data.aboutToHit.map((trend) => ({ trend, aboutToHit: true })),
  ];

  for (const row of allRows) {
    const trend = row.trend;
    const restaurants = trendRestaurants(trend);
    const neighborhoods = trendNeighborhoods(trend);
    for (const hood of neighborhoods) neighborhoodSet.add(hood);

    addLexiconEntry(lexicon, {
      entity: trend.name,
      normalized: safeNormalize(trend.name),
      entityType: "dish",
      category: "dish",
      origin: "trend_title",
      candidateOnly: false,
      trendId: trend.id,
      restaurants,
      neighborhoods,
      aboutToHit: row.aboutToHit,
    });

    for (const item of trend.menuItems) {
      const entity = item.trim();
      if (!entity) continue;
      addLexiconEntry(lexicon, {
        entity,
        normalized: safeNormalize(entity),
        entityType: "dish",
        category: "dish",
        origin: "menu_item",
        candidateOnly: false,
        trendId: trend.id,
        restaurants,
        neighborhoods,
        aboutToHit: row.aboutToHit,
      });
    }

    if (trend.cuisineOrigin?.trim()) {
      addLexiconEntry(lexicon, {
        entity: trend.cuisineOrigin.trim(),
        normalized: safeNormalize(trend.cuisineOrigin),
        entityType: "cuisine",
        category: "cuisine",
        origin: "cuisine_seed",
        candidateOnly: false,
        trendId: trend.id,
        restaurants,
        neighborhoods,
        aboutToHit: row.aboutToHit,
      });
    }

    for (const restaurant of trend.restaurants) {
      const entity = restaurant.name.trim();
      if (!entity) continue;
      addLexiconEntry(lexicon, {
        entity,
        normalized: safeNormalize(entity),
        entityType: "restaurant",
        category: "restaurant_format",
        origin: "restaurant",
        candidateOnly: false,
        trendId: trend.id,
        restaurants: [entity],
        neighborhoods: restaurant.neighborhood ? [restaurant.neighborhood.trim()] : neighborhoods,
        aboutToHit: row.aboutToHit,
      });
    }
  }

  const seedLexicon = buildEditorialLexicon({
    trendNames: data.trends.map((t) => t.name).concat(data.aboutToHit.map((t) => t.name)),
    menuItems: [...data.trends, ...data.aboutToHit].flatMap((t) => t.menuItems),
    restaurants: [...data.trends, ...data.aboutToHit].flatMap((t) => t.restaurants.map((r) => r.name)),
    cuisines: [...data.trends, ...data.aboutToHit]
      .map((t) => t.cuisineOrigin?.trim() ?? "")
      .filter(Boolean),
    neighborhoods: [...neighborhoodSet],
  });

  for (const seed of seedLexicon.entries) {
    addLexiconEntry(lexicon, {
      entity: seed.term,
      normalized: seed.normalized,
      entityType: seed.entityType as LexiconEntityType,
      category: seed.category,
      origin: seed.candidateOnly ? "candidate_term" : "cuisine_seed",
      candidateOnly: seed.candidateOnly,
      trendId: `candidate:${seed.normalized}`,
      restaurants: [],
      neighborhoods: [],
      aboutToHit: false,
    });
  }

  return {
    entries: [...lexicon.values()],
    neighborhoodTerms: [...new Set([...neighborhoodSet, ...seedLexicon.neighborhoods])].filter(Boolean),
    genericSingleWordTerms: seedLexicon.genericSingleWordTerms,
  };
}

function detectNeighborhoodMentions(textNorm: string, terms: string[]): string[] {
  const out = new Set<string>();
  for (const term of terms) {
    const norm = safeNormalize(term);
    if (normalizedContains(textNorm, norm)) out.add(term);
  }
  return [...out];
}

function toPublicationSource(signalSource: PublicationSource): SignalSource {
  return signalSource;
}

function articleTimestamp(article: EditorialArticle, nowIso: string): string {
  const parsed = Date.parse(article.publishedAt);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : nowIso;
}

function isSingleWord(term: string): boolean {
  return term.trim().split(/\s+/).length === 1;
}

function confidenceForMatch(
  entry: LexiconEntry,
  inTitle: boolean,
  inSubhead: boolean,
): number {
  if (entry.origin === "trend_title") return inTitle ? 0.85 : 0.72;
  if (entry.origin === "menu_item") return inTitle ? 0.75 : 0.64;
  if (entry.origin === "restaurant") return inTitle ? 0.7 : 0.62;
  if (entry.candidateOnly) {
    if (entry.category === "dish") {
      if (inTitle && inSubhead) return 0.65;
      if (inTitle) return 0.58;
      return 0.5;
    }
    if (entry.category === "restaurant_format") {
      if (inTitle && inSubhead) return 0.58;
      if (inTitle) return 0.52;
      return 0.45;
    }
    if (entry.category === "ingredient") {
      if (inTitle && inSubhead) return 0.54;
      if (inTitle) return 0.5;
      return 0.45;
    }
    if (entry.category === "cuisine") {
      if (inTitle && inSubhead) return 0.5;
      if (inTitle) return 0.46;
      return 0.45;
    }
    if (entry.category === "dining_behavior") {
      if (inTitle && inSubhead) return 0.48;
      if (inTitle) return 0.45;
      return 0.45;
    }
    return 0.45;
  }
  return inTitle ? 0.74 : 0.62;
}

const GENERIC_ENTITY_STOPWORDS = new Set([
  "restaurant",
  "restaurants",
  "los angeles",
  "la",
  "food",
  "best",
  "cheap",
  "easy",
  "where to eat",
  "new restaurants",
]);
const DISH_HEADWORDS = [
  "taco",
  "tacos",
  "tostada",
  "tostadas",
  "ramen",
  "pho",
  "dumpling",
  "dumplings",
  "sandwich",
  "sandwiches",
  "burger",
  "burgers",
  "pizza",
  "sushi",
  "pasta",
  "birria",
  "aguachile",
  "ceviche",
  "burrito",
  "burritos",
];
const INGREDIENT_TERMS = ["tuna", "matcha", "miso", "chile", "corn", "pork", "beef", "shrimp"];
const CUISINE_TERMS = [
  "korean",
  "thai",
  "mexican",
  "japanese",
  "filipino",
  "vietnamese",
  "chinese",
  "italian",
  "armenian",
  "persian",
];

type HeuristicEntity = {
  entity: string;
  entityType: LexiconEntityType;
  category: EditorialLexiconCategory;
  confidence: number;
  matchScope: "title" | "subhead";
  matchReason: string;
};

function cleanEntityText(value: string): string {
  return value
    .replace(/[^\w\s'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isGenericEntity(value: string): boolean {
  const lower = value.toLowerCase().trim();
  return !lower || GENERIC_ENTITY_STOPWORDS.has(lower);
}

function extractHeuristicEntitiesFromText(text: string, scope: "title" | "subhead"): HeuristicEntity[] {
  const cleaned = cleanEntityText(text);
  const lower = cleaned.toLowerCase();
  const out: HeuristicEntity[] = [];
  for (const dish of DISH_HEADWORDS) {
    const re = new RegExp(`\\b([a-z]+\\s+){0,3}${dish}\\b`, "ig");
    const matches = cleaned.match(re) ?? [];
    for (const m of matches) {
      const entity = cleanEntityText(m).replace(/^(the|these|those|best|new)\s+/i, "");
      if (isGenericEntity(entity)) continue;
      const pushDish = (dishEntity: string) =>
        out.push({
          entity: dishEntity,
          entityType: "dish",
          category: "dish",
          confidence: scope === "title" ? 0.58 : 0.5,
          matchScope: scope,
          matchReason: "title_pattern_dish",
        });
      pushDish(entity);
      const words = entity.split(/\s+/).filter(Boolean);
      if (words.length >= 2) {
        const lastTwo = `${words[words.length - 2]} ${words[words.length - 1]}`;
        if (!isGenericEntity(lastTwo)) pushDish(lastTwo);
      }
      if (!isGenericEntity(dish)) {
        pushDish(dish);
      }
    }
  }
  for (const ingredient of INGREDIENT_TERMS) {
    const re = new RegExp(`\\b${ingredient}\\b`, "i");
    if (!re.test(lower)) continue;
    out.push({
      entity: ingredient,
      entityType: "ingredient",
      category: "ingredient",
      confidence: scope === "title" ? 0.44 : 0.38,
      matchScope: scope,
      matchReason: "ingredient_term",
    });
  }
  for (const cuisine of CUISINE_TERMS) {
    const re = new RegExp(`\\b${cuisine}\\b`, "i");
    if (!re.test(lower)) continue;
    out.push({
      entity: cuisine,
      entityType: "cuisine",
      category: "cuisine",
      confidence: 0.34,
      matchScope: scope,
      matchReason: "cuisine_term",
    });
  }
  const restaurantMatches = text.match(/(?:\bat\s+|\bfrom\s+)([A-Z][A-Za-z0-9'&.-]*(?:\s+[A-Z][A-Za-z0-9'&.-]*){0,3})/g) ?? [];
  for (const raw of restaurantMatches) {
    const entity = cleanEntityText(raw.replace(/^(at|from)\s+/i, ""));
    if (!entity || isGenericEntity(entity)) continue;
    out.push({
      entity,
      entityType: "restaurant",
      category: "restaurant_format",
      confidence: scope === "title" ? 0.34 : 0.31,
      matchScope: scope,
      matchReason: "restaurant_name_heuristic",
    });
  }
  return out;
}

function isGenericListicleHeadline(title: string): boolean {
  const lower = title.toLowerCase();
  return (
    /\bbest restaurants?\b/.test(lower) ||
    /\bwhere to eat\b/.test(lower) ||
    /\bnew restaurants?\b/.test(lower)
  );
}

type CandidateFilterDecision = {
  keep: boolean;
  rejectedBy: "category" | "confidence" | null;
};

function candidateFilterDecision(
  signal: TrendSignal,
  repeatedAcrossPublications: boolean,
): CandidateFilterDecision {
  if (!signal.metadata?.candidateOnly) return { keep: true, rejectedBy: null };
  const category = signal.metadata?.matchedCategory;
  const scope = signal.metadata?.matchScope;
  const titleMatch = scope === "title" || scope === "title+subhead";
  const allowedCategory =
    category === "dish" || category === "ingredient" || category === "restaurant_format";
  if (!allowedCategory && !titleMatch && !repeatedAcrossPublications) {
    return { keep: false, rejectedBy: "category" };
  }
  const minConfidence =
    category === "dish"
      ? 0.45
      : category === "ingredient"
        ? 0.38
        : category === "restaurant_format"
          ? 0.34
          : 0.32;
  if (!repeatedAcrossPublications && signal.confidence < minConfidence) {
    return { keep: false, rejectedBy: "confidence" };
  }
  return { keep: true, rejectedBy: null };
}

function extractSignalsFromArticle(
  article: EditorialArticle,
  lexicon: LexiconEntry[],
  neighborhoodTerms: string[],
  genericSingleWordTerms: Set<string>,
  nowIso: string,
): {
  signals: TrendSignal[];
  ignoredGenericMatches: IgnoredGenericMatch[];
  suppressedNeighborhoodCandidates: SuppressedNeighborhoodCandidate[];
  neighborhoodMentionsAttached: number;
  dedupeRejectedCount: number;
} {
  const titleNorm = safeNormalize(article.title);
  const subheadNorm = safeNormalize(article.subhead);
  const mergedNorm = [titleNorm, subheadNorm].filter(Boolean).join(" ");
  if (!mergedNorm) {
    return {
      signals: [],
      ignoredGenericMatches: [],
      suppressedNeighborhoodCandidates: [],
      neighborhoodMentionsAttached: 0,
      dedupeRejectedCount: 0,
    };
  }

  const foundNeighborhoods = detectNeighborhoodMentions(mergedNorm, neighborhoodTerms);
  const out: TrendSignal[] = [];
  const ignoredGenericMatches: IgnoredGenericMatch[] = [];
  const suppressedNeighborhoodCandidates: SuppressedNeighborhoodCandidate[] = [];
  const seen = new Set<string>();
  let dedupeRejectedCount = 0;
  const matches = lexicon
    .map((entry) => {
      const inTitle = normalizedContains(titleNorm, entry.normalized);
      const inSubhead = normalizedContains(subheadNorm, entry.normalized);
      return { entry, inTitle, inSubhead };
    })
    .filter((row) => row.inTitle || row.inSubhead);
  const hasStrongContext = matches.some(
    (row) => !row.entry.candidateOnly || row.entry.origin === "trend_title" || row.entry.origin === "menu_item",
  );
  const hasDishOrFormatContext = matches.some(
    (row) =>
      row.entry.category === "dish" ||
      row.entry.category === "restaurant_format" ||
      row.entry.origin === "menu_item" ||
      row.entry.origin === "trend_title",
  );

  for (const { entry, inTitle, inSubhead } of matches) {
    if (entry.category === "neighborhood") {
      suppressedNeighborhoodCandidates.push({
        publication: article.source,
        articleTitle: article.title,
        matchedPhrase: entry.entity,
        reason: "neighborhood-metadata-only",
      });
      continue;
    }
    if (
      isSingleWord(entry.normalized) &&
      genericSingleWordTerms.has(entry.normalized) &&
      !hasStrongContext
    ) {
      ignoredGenericMatches.push({
        publication: article.source,
        articleTitle: article.title,
        matchedPhrase: entry.entity,
        matchedCategory: entry.category,
        reason: "generic-single-word-without-strong-context",
      });
      continue;
    }
    if (
      entry.candidateOnly &&
      entry.category === "cuisine" &&
      !hasDishOrFormatContext &&
      !inTitle
    ) {
      ignoredGenericMatches.push({
        publication: article.source,
        articleTitle: article.title,
        matchedPhrase: entry.entity,
        matchedCategory: entry.category,
        reason: "cuisine-candidate-without-dish-format-context",
      });
      continue;
    }
    const dedupeKey = `${article.source}:${article.link}:${entry.normalized}`;
    if (seen.has(dedupeKey)) {
      dedupeRejectedCount += 1;
      continue;
    }
    seen.add(dedupeKey);

    const confidence = confidenceForMatch(entry, inTitle, inSubhead);
    const sourceWeight = EDITORIAL_SOURCE_WEIGHTS[article.source];
    const velocityBase = inTitle && inSubhead ? 0.78 : inTitle ? 0.66 : 0.54;
    const velocity = Math.min(1.35, velocityBase + (entry.aboutToHit ? 0.12 : 0));
    out.push({
      id: `editorial:${article.source}:${safeNormalize(article.link)}:${entry.normalized}`,
      source: toPublicationSource(article.source),
      entityType: entry.entityType,
      entity: entry.entity,
      confidence,
      velocity,
      timestamp: articleTimestamp(article, nowIso),
      metadata: {
        publication: article.source,
        articleTitle: article.title,
        articleUrl: article.link,
        articleId: `${article.source}:${article.link}`,
        sourceWeight,
        trendId: entry.trendId,
        aboutToHit: entry.aboutToHit,
        candidateOnly: entry.candidateOnly,
        matchScope: inTitle && inSubhead ? "title+subhead" : inTitle ? "title" : "subhead",
        matchedPhrase: entry.entity,
        matchedCategory: entry.category,
        matchReason: entry.origin,
        restaurants: entry.restaurants,
        neighborhoods: [...new Set([...entry.neighborhoods, ...foundNeighborhoods])],
      },
    });
  }

  const genericListicle = article.source === "timeout_la" && isGenericListicleHeadline(article.title);
  const heuristicEntities = [
    ...extractHeuristicEntitiesFromText(article.title, "title"),
    ...extractHeuristicEntitiesFromText(article.subhead, "subhead"),
  ];
  for (const heuristic of heuristicEntities) {
    if (genericListicle && heuristic.matchReason === "title_pattern_dish" && heuristic.matchScope === "title") {
      continue;
    }
    const normalized = safeNormalize(heuristic.entity);
    if (!normalized || isGenericEntity(heuristic.entity)) continue;
    const dedupeKey = `${article.source}:${article.link}:heuristic:${normalized}`;
    if (seen.has(dedupeKey)) {
      dedupeRejectedCount += 1;
      continue;
    }
    seen.add(dedupeKey);
    out.push({
      id: `editorial:${article.source}:${safeNormalize(article.link)}:heuristic:${normalized}`,
      source: toPublicationSource(article.source),
      entityType: heuristic.entityType,
      entity: heuristic.entity,
      confidence: heuristic.confidence,
      velocity: 0.48,
      timestamp: articleTimestamp(article, nowIso),
      metadata: {
        publication: article.source,
        articleTitle: article.title,
        articleUrl: article.link,
        articleId: `${article.source}:${article.link}`,
        sourceWeight: EDITORIAL_SOURCE_WEIGHTS[article.source],
        trendId: `candidate:${normalized}`,
        aboutToHit: false,
        candidateOnly: true,
        matchScope: heuristic.matchScope,
        matchedPhrase: heuristic.entity,
        matchedCategory: heuristic.category,
        matchReason: heuristic.matchReason,
        restaurants: [],
        neighborhoods: foundNeighborhoods,
      },
    });
  }

  return {
    signals: out,
    ignoredGenericMatches,
    suppressedNeighborhoodCandidates,
    neighborhoodMentionsAttached: foundNeighborhoods.length,
    dedupeRejectedCount,
  };
}

function manualSignalsForTrend(trend: Trend, aboutToHit: boolean, nowIso: string): TrendSignal[] {
  const restaurants = trendRestaurants(trend);
  const neighborhoods = trendNeighborhoods(trend);
  const out: TrendSignal[] = [];
  out.push({
    id: `manual:${trend.id}:trend`,
    source: "manual_editorial",
    entityType: "dish",
    entity: trend.name,
    confidence: 0.9,
    velocity: Math.min(1, Math.max(0.2, trend.signalScore / 100)),
    timestamp: trend.lastUpdated || nowIso,
    metadata: { restaurants, neighborhoods, trendId: trend.id, aboutToHit, sourceWeight: 0.18 },
  });
  for (const dish of trend.menuItems) {
    const item = dish.trim();
    if (!item) continue;
    out.push({
      id: `manual:${trend.id}:menu:${item.toLowerCase()}`,
      source: "manual_editorial",
      entityType: "dish",
      entity: item,
      confidence: 0.75,
      velocity: Math.min(1, Math.max(0.1, trend.signalScore / 130)),
      timestamp: trend.lastUpdated || nowIso,
      metadata: { restaurants, neighborhoods, trendId: trend.id, aboutToHit, sourceWeight: 0.18 },
    });
  }
  return out;
}

function computeIngestionStats(
  articles: EditorialArticle[],
  signals: TrendSignal[],
  candidateSignals: TrendSignal[],
  feedDiagnostics: EditorialFeedDiagnostic[],
  dedupeRejectedBySource: Record<PublicationSource, number>,
  sourceExtractionFunnel: Record<
    PublicationSource,
    {
      articlesWithExtractableEntities: number;
      extractedEntities: number;
      rejectedByCategory: number;
      rejectedByConfidence: number;
      rejectedByDeduplication: number;
      candidateTrends: number;
      finalSignals: number;
    }
  >,
  ignoredGenericMatches: IgnoredGenericMatch[],
  suppressedNeighborhoodCandidates: SuppressedNeighborhoodCandidate[],
  neighborhoodMentionsAttached: number,
): EditorialIngestionStats {
  const scannedBySource: Record<PublicationSource, number> = {
    eater: 0,
    infatuation: 0,
    latimes: 0,
    resy_la: 0,
    timeout_la: 0,
    bonappetit: 0,
  };
  for (const article of articles) scannedBySource[article.source] += 1;

  const byEntity = new Map<string, { mentions: number; sources: Set<PublicationSource> }>();
  for (const signal of signals) {
    if (
      signal.source !== "eater" &&
      signal.source !== "infatuation" &&
      signal.source !== "latimes" &&
      signal.source !== "resy_la" &&
      signal.source !== "timeout_la" &&
      signal.source !== "bonappetit"
    ) {
      continue;
    }
    const key = safeNormalize(signal.entity);
    const current = byEntity.get(key) ?? { mentions: 0, sources: new Set<PublicationSource>() };
    current.mentions += 1;
    current.sources.add(signal.source);
    byEntity.set(key, current);
  }

  const overlapEntities = [...byEntity.entries()]
    .filter(([, info]) => info.sources.size > 1)
    .sort((a, b) => b[1].sources.size - a[1].sources.size || b[1].mentions - a[1].mentions)
    .slice(0, MAX_TOP_ENTITIES)
    .map(([entity, info]) => ({ entity, sources: [...info.sources] }));

  const topEntities = [...byEntity.entries()]
    .sort((a, b) => b[1].mentions - a[1].mentions)
    .slice(0, MAX_TOP_ENTITIES)
    .map(([entity, info]) => ({ entity, mentions: info.mentions }));
  const candidateOnlyByEntity = new Map<string, number>();
  for (const signal of signals) {
    if (!signal.metadata?.candidateOnly) continue;
    candidateOnlyByEntity.set(signal.entity, (candidateOnlyByEntity.get(signal.entity) ?? 0) + 1);
  }
  const candidateOnlyTopEntities = [...candidateOnlyByEntity.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_TOP_ENTITIES)
    .map(([entity, mentions]) => ({ entity, mentions }));
  const byCategory = (
    category: EditorialLexiconCategory,
    limit = MAX_TOP_ENTITIES,
  ): Array<{ entity: string; mentions: number }> => {
    const map = new Map<string, number>();
    for (const signal of signals) {
      if (!signal.metadata?.candidateOnly) continue;
      if (signal.metadata?.matchedCategory !== category) continue;
      map.set(signal.entity, (map.get(signal.entity) ?? 0) + 1);
    }
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([entity, mentions]) => ({ entity, mentions }));
  };

  const failedSources = FEED_CONFIGS.map((cfg) => cfg.source).filter((src) => scannedBySource[src] === 0);
  const candidateSignalsBySource: Record<PublicationSource, number> = {
    eater: 0,
    infatuation: 0,
    latimes: 0,
    resy_la: 0,
    timeout_la: 0,
    bonappetit: 0,
  };
  const finalSignalsBySource: Record<PublicationSource, number> = {
    eater: 0,
    infatuation: 0,
    latimes: 0,
    resy_la: 0,
    timeout_la: 0,
    bonappetit: 0,
  };
  for (const signal of candidateSignals) {
    if (signal.source in candidateSignalsBySource) {
      const key = signal.source as PublicationSource;
      candidateSignalsBySource[key] += 1;
    }
  }
  for (const signal of signals) {
    if (signal.source in finalSignalsBySource) {
      const key = signal.source as PublicationSource;
      finalSignalsBySource[key] += 1;
    }
  }
  const diagnosticsBySource = new Map(feedDiagnostics.map((diag) => [diag.source, diag]));
  const sourceSignalFunnel = FEED_CONFIGS.reduce(
    (acc, cfg) => {
      const diag = diagnosticsBySource.get(cfg.source);
      const candidateCount = candidateSignalsBySource[cfg.source] ?? 0;
      const finalCount = finalSignalsBySource[cfg.source] ?? 0;
      acc[cfg.source] = {
        fetchedItems: diag?.sourceDiagnostics.fetchedItems ?? 0,
        laRelevantItems: diag?.sourceDiagnostics.laRelevantItems ?? 0,
        normalizedArticles: diag?.sourceDiagnostics.normalizedArticles ?? 0,
        articlesWithExtractableEntities:
          sourceExtractionFunnel[cfg.source]?.articlesWithExtractableEntities ?? 0,
        extractedEntities: sourceExtractionFunnel[cfg.source]?.extractedEntities ?? 0,
        candidateSignals: candidateCount,
        candidateTrends: sourceExtractionFunnel[cfg.source]?.candidateTrends ?? 0,
        finalSignals: sourceExtractionFunnel[cfg.source]?.finalSignals ?? finalCount,
        rejectedByRelevance: Math.max(0, candidateCount - finalCount),
        rejectedByCategory: sourceExtractionFunnel[cfg.source]?.rejectedByCategory ?? 0,
        rejectedByConfidence: sourceExtractionFunnel[cfg.source]?.rejectedByConfidence ?? 0,
        rejectedByDeduplication:
          (sourceExtractionFunnel[cfg.source]?.rejectedByDeduplication ?? 0) +
          (dedupeRejectedBySource[cfg.source] ?? 0),
        rejectedItems: diag?.sourceDiagnostics.rejectedItems ?? 0,
        rejectReasons: diag?.sourceDiagnostics.rejectReasons ?? {},
      };
      return acc;
    },
    {} as EditorialIngestionStats["sourceSignalFunnel"],
  );

  return {
    scannedBySource,
    scannedTotal: articles.length,
    entitiesExtracted: signals.length,
    overlapEntities,
    topEntities,
    candidateOnlyTopEntities,
    topDishCandidates: byCategory("dish"),
    topFormatCandidates: byCategory("restaurant_format"),
    topIngredientCandidates: byCategory("ingredient"),
    neighborhoodMentionsAttached,
    suppressedNeighborhoodCandidates: suppressedNeighborhoodCandidates.slice(0, 24),
    ignoredGenericMatches: ignoredGenericMatches.slice(0, 24),
    failedSources,
    sourceSignalFunnel,
  };
}

export function getLastEditorialIngestionStats(): EditorialIngestionStats {
  return lastIngestionStats;
}

export function getEditorialLexiconPreview(data: LaFoodTrendsDataFile): {
  totalEntities: number;
  dishes: number;
  restaurants: number;
  cuisines: number;
  ingredients: number;
  sample: Array<{
    entity: string;
    entityType: LexiconEntityType;
    category: EditorialLexiconCategory;
    candidateOnly: boolean;
    normalized: string;
  }>;
} {
  const { entries } = buildLexicon(data);
  const dishes = entries.filter((e) => e.entityType === "dish").length;
  const restaurants = entries.filter((e) => e.entityType === "restaurant").length;
  const cuisines = entries.filter((e) => e.entityType === "cuisine").length;
  const ingredients = entries.filter((e) => e.entityType === "ingredient").length;
  return {
    totalEntities: entries.length,
    dishes,
    restaurants,
    cuisines,
    ingredients,
    sample: entries.slice(0, 12).map((entry) => ({
      entity: entry.entity,
      entityType: entry.entityType,
      category: entry.category,
      candidateOnly: entry.candidateOnly,
      normalized: entry.normalized,
    })),
  };
}

export function compareTitlesAgainstLexicon(
  data: LaFoodTrendsDataFile,
  titles: string[],
): Array<{
  title: string;
  matchedEntityCount: number;
  matchedEntities: string[];
}> {
  const { entries } = buildLexicon(data);
  return titles.map((title) => {
    const titleNorm = safeNormalize(title);
    const matchedEntities = entries
      .filter((entry) => normalizedContains(titleNorm, entry.normalized))
      .map((entry) => entry.entity)
      .slice(0, 10);
    return {
      title,
      matchedEntityCount: matchedEntities.length,
      matchedEntities,
    };
  });
}

export async function getEditorialSignals(
  data: LaFoodTrendsDataFile,
  nowIso: string,
): Promise<TrendSignal[]> {
  const manual = [
    ...data.trends.flatMap((trend) => manualSignalsForTrend(trend, false, nowIso)),
    ...data.aboutToHit.flatMap((trend) => manualSignalsForTrend(trend, true, nowIso)),
  ];
  const { entries, neighborhoodTerms, genericSingleWordTerms } = buildLexicon(data);

  const feeds = await Promise.all(
    FEED_CONFIGS.map(async (cfg) => ({
      cfg,
      articles: await fetchFeedArticles(cfg),
    })),
  );
  const allArticles = feeds.flatMap((f) => f.articles);
  const extracted = allArticles.map((article) =>
    extractSignalsFromArticle(article, entries, neighborhoodTerms, genericSingleWordTerms, nowIso),
  );
  const sourceExtractionFunnel = {
    eater: {
      articlesWithExtractableEntities: 0,
      extractedEntities: 0,
      rejectedByCategory: 0,
      rejectedByConfidence: 0,
      rejectedByDeduplication: 0,
      candidateTrends: 0,
      finalSignals: 0,
    },
    infatuation: {
      articlesWithExtractableEntities: 0,
      extractedEntities: 0,
      rejectedByCategory: 0,
      rejectedByConfidence: 0,
      rejectedByDeduplication: 0,
      candidateTrends: 0,
      finalSignals: 0,
    },
    latimes: {
      articlesWithExtractableEntities: 0,
      extractedEntities: 0,
      rejectedByCategory: 0,
      rejectedByConfidence: 0,
      rejectedByDeduplication: 0,
      candidateTrends: 0,
      finalSignals: 0,
    },
    resy_la: {
      articlesWithExtractableEntities: 0,
      extractedEntities: 0,
      rejectedByCategory: 0,
      rejectedByConfidence: 0,
      rejectedByDeduplication: 0,
      candidateTrends: 0,
      finalSignals: 0,
    },
    timeout_la: {
      articlesWithExtractableEntities: 0,
      extractedEntities: 0,
      rejectedByCategory: 0,
      rejectedByConfidence: 0,
      rejectedByDeduplication: 0,
      candidateTrends: 0,
      finalSignals: 0,
    },
    bonappetit: {
      articlesWithExtractableEntities: 0,
      extractedEntities: 0,
      rejectedByCategory: 0,
      rejectedByConfidence: 0,
      rejectedByDeduplication: 0,
      candidateTrends: 0,
      finalSignals: 0,
    },
  } satisfies Record<
    PublicationSource,
    {
      articlesWithExtractableEntities: number;
      extractedEntities: number;
      rejectedByCategory: number;
      rejectedByConfidence: number;
      rejectedByDeduplication: number;
      candidateTrends: number;
      finalSignals: number;
    }
  >;
  for (let idx = 0; idx < extracted.length; idx += 1) {
    const source = allArticles[idx]?.source;
    if (!source) continue;
    const row = extracted[idx];
    if (row.signals.length > 0) sourceExtractionFunnel[source].articlesWithExtractableEntities += 1;
    sourceExtractionFunnel[source].extractedEntities += row.signals.length;
    sourceExtractionFunnel[source].rejectedByDeduplication += row.dedupeRejectedCount;
  }
  const prefilteredEditorialSignals = extracted.flatMap((row) => row.signals);
  const candidatePublicationCounts = new Map<string, Set<PublicationSource>>();
  for (const signal of prefilteredEditorialSignals) {
    if (!signal.metadata?.candidateOnly) continue;
    const key = safeNormalize(signal.entity);
    const set = candidatePublicationCounts.get(key) ?? new Set<PublicationSource>();
    if (
      signal.source === "eater" ||
      signal.source === "infatuation" ||
      signal.source === "latimes" ||
      signal.source === "resy_la" ||
      signal.source === "timeout_la" ||
      signal.source === "bonappetit"
    ) {
      set.add(signal.source);
    }
    candidatePublicationCounts.set(key, set);
  }
  const editorialSignals: TrendSignal[] = [];
  const postFilterSeen = new Set<string>();
  for (const signal of prefilteredEditorialSignals) {
    const src = signal.source as PublicationSource;
    const signalKey = `${signal.source}:${signal.metadata?.articleId ?? ""}:${safeNormalize(signal.entity)}`;
    if (postFilterSeen.has(signalKey)) {
      sourceExtractionFunnel[src].rejectedByDeduplication += 1;
      continue;
    }
    postFilterSeen.add(signalKey);
    if (!signal.metadata?.candidateOnly) {
      editorialSignals.push(signal);
      sourceExtractionFunnel[src].finalSignals += 1;
      continue;
    }
    const repeatedAcrossPublications =
      (candidatePublicationCounts.get(safeNormalize(signal.entity))?.size ?? 0) >= 2;
    const decision = candidateFilterDecision(signal, repeatedAcrossPublications);
    if (!decision.keep && decision.rejectedBy === "category") {
      sourceExtractionFunnel[src].rejectedByCategory += 1;
      continue;
    }
    if (!decision.keep && decision.rejectedBy === "confidence") {
      sourceExtractionFunnel[src].rejectedByConfidence += 1;
      continue;
    }
    editorialSignals.push(signal);
    sourceExtractionFunnel[src].finalSignals += 1;
  }
  const candidateEntitySets = {
    eater: new Set<string>(),
    infatuation: new Set<string>(),
    latimes: new Set<string>(),
    resy_la: new Set<string>(),
    timeout_la: new Set<string>(),
    bonappetit: new Set<string>(),
  } as Record<PublicationSource, Set<string>>;
  for (const signal of editorialSignals) {
    const src = signal.source as PublicationSource;
    candidateEntitySets[src].add(safeNormalize(signal.entity));
  }
  (Object.keys(candidateEntitySets) as PublicationSource[]).forEach((src) => {
    sourceExtractionFunnel[src].candidateTrends = candidateEntitySets[src].size;
  });
  const dedupeRejectedBySource = extracted.reduce(
    (acc, row, idx) => {
      const source = allArticles[idx]?.source;
      if (!source) return acc;
      acc[source] = (acc[source] ?? 0) + row.dedupeRejectedCount;
      return acc;
    },
    {
      eater: 0,
      infatuation: 0,
      latimes: 0,
      resy_la: 0,
      timeout_la: 0,
      bonappetit: 0,
    } as Record<PublicationSource, number>,
  );
  const feedDiagnostics = await getEditorialFeedDiagnostics();
  const ignoredGenericMatches = extracted.flatMap((row) => row.ignoredGenericMatches);
  const suppressedNeighborhoodCandidates = extracted.flatMap((row) => row.suppressedNeighborhoodCandidates);
  const neighborhoodMentionsAttached = extracted.reduce(
    (sum, row) => sum + row.neighborhoodMentionsAttached,
    0,
  );

  lastIngestionStats = computeIngestionStats(
    allArticles,
    editorialSignals,
    prefilteredEditorialSignals,
    feedDiagnostics,
    dedupeRejectedBySource,
    sourceExtractionFunnel,
    ignoredGenericMatches,
    suppressedNeighborhoodCandidates,
    neighborhoodMentionsAttached,
  );
  return [...manual, ...editorialSignals];
}

export const editorialSourceTestUtils = {
  parseTimeoutHtmlArticles,
  evaluateSourceFilter,
  extractHeuristicEntitiesFromText,
  isGenericListicleHeadline,
  candidateFilterDecision,
};
