import type {
  RedditIngestHealth,
  RedditIngestResult,
  RedditSearchSignal,
  RedditSignal,
} from "@/types/redditSignal";

const TOKEN_URL = "https://www.reddit.com/api/v1/access_token";
const SEARCH_URL = "https://oauth.reddit.com/search";

/** Target LA discussion subs (official API only). */
export const REDDIT_LA_SUBREDDITS = [
  "FoodLosAngeles",
  "AskLosAngeles",
  "LosAngeles",
  "LAfoodies",
] as const;

export const REDDIT_SEARCH_TERMS = [
  "Los Angeles food",
  "LA restaurant",
  "best in LA",
  "where can I find",
  "new restaurant",
  "pop-up",
  "tacos",
  "bagels",
  "matcha",
  "sandwich",
  "burger",
  "coffee",
  "cocktail",
  "dessert",
  "Korean",
  "Thai",
  "Japanese",
  "Mexican",
  "Filipino",
  "Vietnamese",
] as const;

const INGEST_MAX_AGE_SEC = 30 * 24 * 60 * 60;
const WEEKEND_MAX_AGE_SEC = 14 * 24 * 60 * 60;
const RISING_WINDOW_SEC = 7 * 24 * 60 * 60;

const SEARCH_LIMIT = 25;
const CACHE_TTL_MS = 8 * 60 * 1000;
const MIN_REQUEST_GAP_MS = 1100;

type RedditTokenJson = {
  access_token?: string;
  expires_in?: number;
};

export type RedditRawPost = {
  id: string;
  subreddit: string;
  title: string;
  selftext: string;
  permalink: string;
  score: number;
  num_comments: number;
  created_utc: number;
  url: string;
};

type RedditListingChild = {
  kind?: string;
  data?: Record<string, unknown>;
};

type RedditListingJson = {
  data?: {
    children?: RedditListingChild[];
  };
};

const POLITICAL_HINTS =
  /\b(trump|biden|election|congress|senate|governor|ballot|impeach|republican|democrat|january\s*6|city\s*council\s*(hearing|vote))\b/i;

const NEIGHBORHOOD_CANON: { needle: string; label: string }[] = [
  { needle: "koreatown", label: "Koreatown" },
  { needle: "ktown", label: "Koreatown" },
  { needle: "little tokyo", label: "Little Tokyo" },
  { needle: "sawtelle", label: "Sawtelle" },
  { needle: "westwood", label: "Westwood" },
  { needle: "arts district", label: "Arts District" },
  { needle: "silver lake", label: "Silver Lake" },
  { needle: "silverlake", label: "Silver Lake" },
  { needle: "echo park", label: "Echo Park" },
  { needle: "west hollywood", label: "West Hollywood" },
  { needle: "weho", label: "West Hollywood" },
  { needle: "santa monica", label: "Santa Monica" },
  { needle: "venice", label: "Venice" },
  { needle: "mar vista", label: "Mar Vista" },
  { needle: "dtla", label: "DTLA" },
  { needle: "downtown la", label: "Downtown LA" },
  { needle: "downtown los angeles", label: "Downtown LA" },
  { needle: "pasadena", label: "Pasadena" },
  { needle: "glendale", label: "Glendale" },
  { needle: "culver city", label: "Culver City" },
  { needle: "hollywood", label: "Hollywood" },
  { needle: "mid-wilshire", label: "Mid-Wilshire" },
  { needle: "mid wilshire", label: "Mid-Wilshire" },
  { needle: "beverly hills", label: "Beverly Hills" },
  { needle: "west la", label: "West LA" },
  { needle: "marina del rey", label: "Marina del Rey" },
  { needle: "manhattan beach", label: "Manhattan Beach" },
  { needle: "long beach", label: "Long Beach" },
  { needle: "highland park", label: "Highland Park" },
  { needle: "atwater", label: "Atwater Village" },
  { needle: "frogtown", label: "Frogtown" },
  { needle: "los feliz", label: "Los Feliz" },
  { needle: "burbank", label: "Burbank" },
  { needle: "encino", label: "Encino" },
  { needle: "studio city", label: "Studio City" },
  { needle: "north hollywood", label: "North Hollywood" },
  { needle: "no ho", label: "North Hollywood" },
  { needle: "chinatown", label: "Chinatown" },
  { needle: "thai town", label: "Thai Town" },
  { needle: "east la", label: "East LA" },
  { needle: "inglewood", label: "Inglewood" },
  { needle: "el segundo", label: "El Segundo" },
];

const DISH_EXTRAS = [
  "aguachile",
  "birria",
  "ceviche",
  "dim sum",
  "pizza",
  "ramen",
  "pho",
  "sushi",
  "poke",
  "bbq",
  "hand roll",
  "omakase",
  "crudo",
  "natural wine",
];

const PHRASE_WEIGHTS: { re: RegExp; w: number }[] = [
  { re: /where can i find/i, w: 8 },
  { re: /\bbest\b/i, w: 4 },
  { re: /\bnew\b/i, w: 3 },
  { re: /pop[\s-]*up/i, w: 5 },
  { re: /\bunderrated\b/i, w: 5 },
  { re: /\bline\b|lined up|queue/i, w: 4 },
  { re: /reservation|book(?:ing)?/i, w: 4 },
  { re: /(?:\bhype\b|\bbuzz\b|\bviral\b)/i, w: 4 },
];

let tokenCache: {
  token: string;
  expiresAtMs: number;
  mode: "password" | "client";
} | null = null;

type RateSnapshot = { remaining: number | null; resetUtc: number | null };
const rateState: RateSnapshot = { remaining: null, resetUtc: null };

let lastRedditRequestAt = 0;
const searchCache = new Map<string, { expires: number; children: RedditListingChild[] }>();

function requireRedditUserAgent(): string | null {
  const ua = process.env.REDDIT_USER_AGENT?.trim();
  return ua && ua.length > 0 ? ua : null;
}

function redditClientCreds(): { id: string; secret: string } | null {
  const id = process.env.REDDIT_CLIENT_ID?.trim();
  const secret = process.env.REDDIT_CLIENT_SECRET?.trim();
  if (!id || !secret) {
    return null;
  }
  return { id, secret };
}

function redditUserCreds(): { user: string; pass: string } | null {
  const user = process.env.REDDIT_USERNAME?.trim();
  const pass = process.env.REDDIT_PASSWORD?.trim();
  if (!user || !pass) {
    return null;
  }
  return { user, pass };
}

function tokenMode(): "password" | "client" {
  return redditUserCreds() ? "password" : "client";
}

/**
 * OAuth: password grant when `REDDIT_USERNAME` / `REDDIT_PASSWORD` are set,
 * otherwise client credentials (read-only app).
 */
export async function getRedditToken(): Promise<string> {
  const creds = redditClientCreds();
  const ua = requireRedditUserAgent();
  if (!creds || !ua) {
    throw new Error("Reddit env not configured");
  }

  const mode = tokenMode();
  const now = Date.now();
  if (
    tokenCache &&
    tokenCache.mode === mode &&
    tokenCache.expiresAtMs > now + 30_000
  ) {
    return tokenCache.token;
  }

  const basic = Buffer.from(`${creds.id}:${creds.secret}`).toString("base64");
  const body =
    mode === "password"
      ? new URLSearchParams({
          grant_type: "password",
          username: redditUserCreds()!.user,
          password: redditUserCreds()!.pass,
        }).toString()
      : "grant_type=client_credentials";

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": ua,
    },
    body,
  });

  if (!res.ok) {
    throw new Error(`Reddit token request failed (${res.status})`);
  }

  const json = (await res.json()) as RedditTokenJson;
  const access = typeof json.access_token === "string" ? json.access_token : "";
  if (!access) {
    throw new Error("Reddit token response missing access_token");
  }

  const ttlSec =
    typeof json.expires_in === "number" && Number.isFinite(json.expires_in)
      ? json.expires_in
      : 3600;
  tokenCache = {
    token: access,
    expiresAtMs: now + Math.max(60, ttlSec - 30) * 1000,
    mode,
  };
  return access;
}

function parseRateLimitHeaders(res: Response): void {
  const remRaw = res.headers.get("x-ratelimit-remaining");
  const resetRaw = res.headers.get("x-ratelimit-reset");
  if (remRaw != null) {
    const r = Number.parseFloat(remRaw);
    rateState.remaining = Number.isFinite(r) ? r : null;
  }
  if (resetRaw != null) {
    const u = Number.parseInt(resetRaw, 10);
    rateState.resetUtc = Number.isFinite(u) ? u : null;
  }
}

async function respectRateLimit(): Promise<void> {
  if (rateState.remaining != null && rateState.remaining < 1 && rateState.resetUtc != null) {
    const waitMs = Math.max(0, rateState.resetUtc * 1000 - Date.now()) + 250;
    if (waitMs > 0) {
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
  const gap = lastRedditRequestAt + MIN_REQUEST_GAP_MS - Date.now();
  if (gap > 0) {
    await new Promise((r) => setTimeout(r, gap));
  }
}

async function redditFetch(url: string, init: RequestInit): Promise<Response> {
  const ua = requireRedditUserAgent();
  if (!ua) {
    throw new Error("REDDIT_USER_AGENT missing");
  }
  await respectRateLimit();
  const res = await fetch(url, {
    ...init,
    headers: {
      ...init.headers,
      "User-Agent": ua,
    },
  });
  lastRedditRequestAt = Date.now();
  parseRateLimitHeaders(res);
  return res;
}

const allowedSubLower = new Set(
  REDDIT_LA_SUBREDDITS.map((s) => s.trim().toLowerCase()),
);

function normalizeSubName(s: string): string {
  return s.trim().toLowerCase();
}

export function buildSubredditSearchQuery(keyword: string): string {
  const subOr = REDDIT_LA_SUBREDDITS.map((s) => `subreddit:${s}`).join(" OR ");
  return `${keyword} (${subOr})`;
}

function rawPostFromChild(ch: RedditListingChild): RedditRawPost | null {
  const d = ch.data;
  if (!d || typeof d !== "object") {
    return null;
  }
  const id = typeof d.id === "string" ? d.id : "";
  if (!id) {
    return null;
  }
  const sub = typeof d.subreddit === "string" ? d.subreddit : "";
  if (!allowedSubLower.has(normalizeSubName(sub))) {
    return null;
  }
  return {
    id,
    subreddit: sub,
    title: typeof d.title === "string" ? d.title : "",
    selftext: typeof d.selftext === "string" ? d.selftext : "",
    permalink: typeof d.permalink === "string" ? d.permalink : "",
    score: typeof d.score === "number" && Number.isFinite(d.score) ? d.score : 0,
    num_comments:
      typeof d.num_comments === "number" && Number.isFinite(d.num_comments)
        ? d.num_comments
        : 0,
    created_utc:
      typeof d.created_utc === "number" && Number.isFinite(d.created_utc)
        ? d.created_utc
        : 0,
    url: typeof d.url === "string" ? d.url : "",
  };
}

async function fetchSearchChildren(
  searchTerm: string,
  token: string,
  cacheHits: { n: number },
): Promise<RedditListingChild[]> {
  const key = `${searchTerm}|${SEARCH_LIMIT}`;
  const cached = searchCache.get(key);
  const now = Date.now();
  if (cached && cached.expires > now) {
    cacheHits.n += 1;
    return cached.children;
  }

  const url = new URL(SEARCH_URL);
  url.searchParams.set("q", buildSubredditSearchQuery(searchTerm));
  url.searchParams.set("sort", "new");
  url.searchParams.set("limit", String(SEARCH_LIMIT));
  url.searchParams.set("raw_json", "1");

  const res = await redditFetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    return [];
  }
  const json = (await res.json()) as RedditListingJson;
  const children = json.data?.children ?? [];
  searchCache.set(key, { expires: now + CACHE_TTL_MS, children });
  return children;
}

function matchConfiguredTerms(haystack: string): string[] {
  const h = haystack.toLowerCase();
  const out: string[] = [];
  for (const t of REDDIT_SEARCH_TERMS) {
    if (h.includes(t.toLowerCase())) {
      out.push(t);
    }
  }
  return [...new Set(out)];
}

function extractNeighborhoods(haystack: string): string[] {
  const h = haystack.toLowerCase();
  const found = new Set<string>();
  for (const { needle, label } of NEIGHBORHOOD_CANON) {
    if (h.includes(needle)) {
      found.add(label);
    }
  }
  return [...found];
}

function extractDishesExtra(haystack: string, matched: string[]): string[] {
  const h = haystack.toLowerCase();
  const set = new Set<string>();
  for (const m of matched) {
    set.add(m);
  }
  for (const d of DISH_EXTRAS) {
    if (h.includes(d)) {
      set.add(d);
    }
  }
  return [...set];
}

function extractRestaurantsHeuristic(text: string): string[] {
  const out: string[] = [];
  const re =
    /(?:^|[\s('"[.,])(?:at|from|@)\s+([A-Z][A-Za-z0-9&']*(?:\s+[A-Z][A-Za-z0-9&']*){0,4})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const chunk = m[1]?.trim();
    if (chunk && chunk.length > 2 && !/^the\b/i.test(chunk)) {
      out.push(chunk);
    }
  }
  const quoted = /"([^"]{3,80})"/g;
  while ((m = quoted.exec(text)) !== null) {
    const q = m[1]?.trim();
    if (q && /[a-z]/i.test(q)) {
      out.push(q);
    }
  }
  return [...new Set(out)].slice(0, 5);
}

function phraseBoostScore(text: string): number {
  let s = 0;
  for (const { re, w } of PHRASE_WEIGHTS) {
    if (re.test(text)) {
      s += w;
    }
  }
  return Math.min(20, s);
}

function computeRisingTerms(
  posts: RedditRawPost[],
  nowSec: number,
): Set<string> {
  const counts = new Map<string, number>();
  for (const p of posts) {
    if (nowSec - p.created_utc > RISING_WINDOW_SEC) {
      continue;
    }
    const hay = `${p.title} ${p.selftext}`;
    for (const t of matchConfiguredTerms(hay)) {
      const k = t.toLowerCase();
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
  }
  const rising = new Set<string>();
  for (const [t, c] of counts) {
    if (c >= 2) {
      rising.add(t);
    }
  }
  return rising;
}

function passesStaleRule(
  p: RedditRawPost,
  nowSec: number,
  rising: Set<string>,
  matched: string[],
): boolean {
  const age = nowSec - p.created_utc;
  if (age <= INGEST_MAX_AGE_SEC) {
    return true;
  }
  return matched.some((m) => rising.has(m.toLowerCase()));
}

function isPoliticalOrNoise(title: string, body: string): boolean {
  const t = `${title}\n${body}`;
  return POLITICAL_HINTS.test(t);
}

function isGenericNoDish(matched: string[], dishes: string[]): boolean {
  if (matched.length === 0 && dishes.length === 0) {
    return true;
  }
  const onlyGenericQuery =
    matched.length > 0 &&
    matched.every((m) =>
      /^(best in la|los angeles food|la restaurant|where can i find)$/i.test(
        m.trim(),
      ),
    ) &&
    dishes.length === 0;
  return onlyGenericQuery;
}

function recencyPoints(ageSec: number): number {
  const days = ageSec / 86400;
  return Math.max(0, 38 - days * 1.15);
}

function redditSignalScore(
  p: RedditRawPost,
  phrasePts: number,
  matchedCount: number,
  repeatDishBoost: number,
): number {
  const ageSec = Math.max(0, Date.now() / 1000 - p.created_utc);
  let s =
    recencyPoints(ageSec) +
    Math.min(26, 12 * Math.log1p(Math.max(0, p.score))) +
    Math.min(22, 10 * Math.log1p(Math.max(0, p.num_comments))) +
    Math.min(18, matchedCount * 4) +
    phrasePts +
    Math.min(14, repeatDishBoost);
  return Math.min(100, Math.max(0, Math.round(s)));
}

function permalinkUrl(permalink: string): string {
  if (permalink.startsWith("http")) {
    return permalink;
  }
  return `https://www.reddit.com${permalink.startsWith("/") ? "" : "/"}${permalink}`;
}

function toRedditSignal(
  p: RedditRawPost,
  matched: string[],
  dishes: string[],
  hoods: string[],
  restaurants: string[],
  repeatBoost: number,
): RedditSignal {
  const hay = `${p.title} ${p.selftext}`;
  const phrasePts = phraseBoostScore(hay);
  return {
    source: "reddit",
    subreddit: p.subreddit,
    title: p.title,
    body: p.selftext,
    url: permalinkUrl(p.permalink),
    score: p.score,
    num_comments: p.num_comments,
    created_utc: p.created_utc,
    matched_terms: matched,
    extracted_neighborhoods: hoods,
    extracted_dishes: dishes,
    extracted_restaurants: restaurants,
    reddit_signal_score: redditSignalScore(
      p,
      phrasePts,
      matched.length,
      repeatBoost,
    ),
    post_id: p.id,
  };
}

function aggregateTopTerms(
  signals: RedditSignal[],
  pick: "dishes" | "hoods",
  limit: number,
): { term: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const s of signals) {
    const arr =
      pick === "dishes" ? s.extracted_dishes : s.extracted_neighborhoods;
    for (const t of arr) {
      const k = t.toLowerCase();
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([term, count]) => ({ term, count }));
}

/**
 * Full LA subreddit ingestion: all configured search terms, deduped, filtered,
 * scored. Respects rate-limit headers and uses a short TTL search cache.
 */
export async function ingestRedditChatter(): Promise<RedditIngestResult> {
  const emptyHealth: RedditIngestHealth = {
    fetchedCount: 0,
    uniqueFetched: 0,
    keptCount: 0,
    rejectedCount: 0,
    topDishTerms: [],
    topNeighborhoodTerms: [],
    searchQueriesRun: 0,
    cacheHits: 0,
    rateLimitRemaining: null,
  };

  const ua = requireRedditUserAgent();
  if (!ua || !redditClientCreds()) {
    return { signals: [], health: emptyHealth };
  }

  let token: string;
  try {
    token = await getRedditToken();
  } catch {
    return { signals: [], health: emptyHealth };
  }

  const cacheHits = { n: 0 };
  const byId = new Map<string, RedditRawPost>();
  let fetchedCount = 0;

  for (const term of REDDIT_SEARCH_TERMS) {
    let children: RedditListingChild[];
    try {
      children = await fetchSearchChildren(term, token, cacheHits);
    } catch {
      continue;
    }
    fetchedCount += children.length;
    for (const ch of children) {
      const raw = rawPostFromChild(ch);
      if (!raw) {
        continue;
      }
      byId.set(raw.id, raw);
    }
  }

  const nowSec = Date.now() / 1000;
  const allPosts = [...byId.values()];
  const rising = computeRisingTerms(allPosts, nowSec);

  const dishRepeat = new Map<string, number>();
  const candidates: RedditRawPost[] = [];

  for (const p of allPosts) {
    const hay = `${p.title} ${p.selftext}`;
    const matched = matchConfiguredTerms(hay);
    if (!passesStaleRule(p, nowSec, rising, matched)) {
      continue;
    }
    if (isPoliticalOrNoise(p.title, p.selftext)) {
      continue;
    }
    const dishes = extractDishesExtra(hay, matched);
    if (isGenericNoDish(matched, dishes)) {
      continue;
    }
    candidates.push(p);
    for (const d of dishes) {
      const k = d.toLowerCase();
      dishRepeat.set(k, (dishRepeat.get(k) ?? 0) + 1);
    }
  }

  const signals: RedditSignal[] = [];

  for (const p of candidates) {
    const hay = `${p.title} ${p.selftext}`;
    const matched = matchConfiguredTerms(hay);
    const dishes = extractDishesExtra(hay, matched);
    const hoods = extractNeighborhoods(hay);
    const restaurants = extractRestaurantsHeuristic(hay);
    let repeatBoost = 0;
    for (const d of dishes) {
      const c = dishRepeat.get(d.toLowerCase()) ?? 1;
      if (c > 1) {
        repeatBoost += 4 * Math.log1p(c - 1);
      }
    }
    signals.push(
      toRedditSignal(p, matched, dishes, hoods, restaurants, repeatBoost),
    );
  }

  const rejected = allPosts.length - signals.length;

  signals.sort((a, b) => b.reddit_signal_score - a.reddit_signal_score);

  const health: RedditIngestHealth = {
    fetchedCount,
    uniqueFetched: byId.size,
    keptCount: signals.length,
    rejectedCount: rejected,
    topDishTerms: aggregateTopTerms(signals, "dishes", 12),
    topNeighborhoodTerms: aggregateTopTerms(signals, "hoods", 12),
    searchQueriesRun: REDDIT_SEARCH_TERMS.length,
    cacheHits: cacheHits.n,
    rateLimitRemaining: rateState.remaining,
  };

  return { signals, health };
}

const TITLE_STOPWORDS = new Set([
  "the", "and", "for", "with", "this", "that", "from", "have", "has", "was",
  "were", "are", "but", "not", "you", "all", "can", "any", "what", "when",
  "where", "who", "how", "why", "will", "just", "out", "get", "got", "like",
  "one", "some", "today", "into", "about", "your", "more", "here", "there",
  "they", "them", "than", "then", "also", "very", "really", "good", "best",
  "anyone", "know", "looking", "question", "help", "thoughts", "update",
  "la", "los", "angeles",
]);

function tokenizeTitle(title: string): string[] {
  return title
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((w) => w.replace(/^-+|-+$/g, ""))
    .filter((w) => w.length > 2 && !TITLE_STOPWORDS.has(w));
}

export function topPhrasesFromTitles(titles: string[], max = 5): string[] {
  if (!titles.length) {
    return [];
  }
  const counts = new Map<string, number>();
  for (const title of titles) {
    const words = tokenizeTitle(title);
    for (let i = 0; i < words.length; i += 1) {
      counts.set(words[i], (counts.get(words[i]) ?? 0) + 1);
      if (i < words.length - 1) {
        const phrase = `${words[i]} ${words[i + 1]}`;
        counts.set(phrase, (counts.get(phrase) ?? 0) + 1);
      }
    }
  }
  return [...counts.entries()]
    .sort(
      (a, b) =>
        b[1] - a[1] ||
        b[0].split(" ").length - a[0].split(" ").length ||
        b[0].localeCompare(a[0]),
    )
    .slice(0, max)
    .map(([phrase]) => phrase);
}

/**
 * Per-trend query for weekend cron: 14‑day window, silent failure.
 */
export async function searchReddit(query: string): Promise<RedditSearchSignal> {
  const empty: RedditSearchSignal = { postCount: 0, momentumScore: 0, topPhrases: [] };
  const ua = requireRedditUserAgent();
  if (!ua || !redditClientCreds()) {
    return empty;
  }

  try {
    const token = await getRedditToken();
    const cacheHits = { n: 0 };
    const children = await fetchSearchChildren(query.trim(), token, cacheHits);
    const nowSec = Date.now() / 1000;
    const cutoff = nowSec - WEEKEND_MAX_AGE_SEC;
    const titles: string[] = [];
    let totalComments = 0;

    for (const ch of children) {
      const raw = rawPostFromChild(ch);
      if (!raw || raw.created_utc < cutoff) {
        continue;
      }
      if (raw.title) {
        titles.push(raw.title);
      }
      totalComments += raw.num_comments;
    }

    const postCount = titles.length;
    const momentumScore =
      postCount > 0 ? postCount * Math.log(totalComments + 1) : 0;

    return {
      postCount,
      momentumScore,
      topPhrases: topPhrasesFromTitles(titles),
    };
  } catch {
    return empty;
  }
}

export type {
  RedditIngestHealth,
  RedditIngestResult,
  RedditSignal,
  RedditSearchSignal,
} from "@/types/redditSignal";
