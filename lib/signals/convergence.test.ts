import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPersistedTrendConvergence,
  buildPublicConvergenceNarrative,
  computeTrendConvergence,
  sanitizePublicConvergenceCopy,
  type TrendConvergence,
  type TrendHistoryConvergenceEntry,
} from "@/lib/signals/convergence";
import type { Trend } from "@/types/laFoodTrend";

function baseTrend(overrides: Partial<Trend> = {}): Trend {
  return {
    id: "test-1",
    name: "Test Trend",
    description: "desc",
    whyItsEverywhere: "why",
    signalScore: 40,
    lastUpdated: new Date().toISOString(),
    sources: [],
    neighborhoods: [],
    restaurants: [],
    menuItems: [],
    confidence: "low",
    momentumScore: 50,
    popularityScore: 50,
    "short descriptor": "desc",
    "WHY IT'S HITTING": "why",
    "MOST SPOTTED": "",
    "WHAT TO ORDER": [],
    "WORTH THE SPLURGE": "",
    "EASY ENTRY": "",
    "WHY IT WORKS": "",
    ...overrides,
  };
}

test("single weak editorial source stays low confidence and capped score", () => {
  const t = baseTrend({
    name: "Sonoran Taco Wave",
    sources: ["Mentioned once in Eater LA"],
    neighborhoods: ["Silver Lake"],
    restaurants: [{ name: "Taco Spot", neighborhood: "Silver Lake" }],
  });
  const c = computeTrendConvergence(t, { historyEntries: [] });
  assert.equal(c.confidence, "low");
  assert.ok(c.convergenceScore < 55, `expected capped score, got ${c.convergenceScore}`);
  assert.ok(["weak_signal", "emerging"].includes(c.trendState));
});

test("editorial + geo + social proxy increases convergence vs editorial alone", () => {
  const base = baseTrend({
    name: "Natural Wine Bar Cluster",
    sources: ["LA Times Food", "Eater LA"],
    neighborhoods: ["Silver Lake", "Echo Park"],
    evidenceSummary: "Places clustering natural wine format",
    restaurants: [
      { name: "A", neighborhood: "Silver Lake", googleMapsUrl: "https://maps.google.com/?q=a" },
      { name: "B", neighborhood: "Echo Park", googleMapsUrl: "https://maps.google.com/?q=b" },
    ],
    menuItems: ["orange wine", "pet nat"],
  });
  const withSocial = {
    ...base,
    manualSocialSignals: { tiktokSpotted: true, instagramSpotted: false },
  };
  const a = computeTrendConvergence(base, { historyEntries: [] });
  const b = computeTrendConvergence(withSocial, { historyEntries: [] });
  assert.ok(b.convergenceScore > a.convergenceScore);
  assert.ok(b.socialAlignmentScore >= a.socialAlignmentScore);
});

test("multi-neighborhood spread increases geo and overall score", () => {
  const narrow = baseTrend({
    name: "One Hood Pizza",
    sources: ["LA Times", "Infatuation"],
    neighborhoods: ["Silver Lake"],
    restaurants: [{ name: "P1", neighborhood: "Silver Lake" }],
  });
  const wide = baseTrend({
    ...narrow,
    neighborhoods: ["Koreatown", "Silver Lake", "Venice"],
    restaurants: [
      { name: "P1", neighborhood: "Koreatown" },
      { name: "P2", neighborhood: "Silver Lake" },
      { name: "P3", neighborhood: "Venice" },
    ],
  });
  const cn = computeTrendConvergence(narrow, { historyEntries: [] });
  const cw = computeTrendConvergence(wide, { historyEntries: [] });
  assert.ok(cw.geoSpreadScore > cn.geoSpreadScore);
  assert.ok(cw.convergenceScore > cn.convergenceScore);
  assert.ok(cw.neighborhoodCount >= 3);
});

test("social alone without editorial/geo does not reach high confidence", () => {
  const t = baseTrend({
    name: "Viral Only Dish",
    sources: [],
    manualSocialSignals: { tiktokSpotted: true, instagramSpotted: true },
    socialSignals: [
      {
        platform: "tiktok",
        label: "TikTok post",
        url: "https://tiktok.com/example",
        strength: "high",
      },
    ],
  });
  const c = computeTrendConvergence(t, { historyEntries: [] });
  assert.equal(c.confidence, "low");
  assert.ok(c.convergenceScore <= 40);
});

test("persistence from history boosts score", () => {
  const t = baseTrend({
    name: "Persistent Entity X",
    sources: ["LA Times", "Eater LA"],
    neighborhoods: ["Highland Park", "Boyle Heights"],
    restaurants: [
      { name: "R1", neighborhood: "Highland Park" },
      { name: "R2", neighborhood: "Boyle Heights" },
    ],
  });
  const entityKey = "persistent entity x";
  const history: TrendHistoryConvergenceEntry[] = [
    { entity: entityKey, timestamp: "2026-01-01T12:00:00Z", week: "2026-W01", stage: "top5", score: 40 },
    { entity: entityKey, timestamp: "2026-01-08T12:00:00Z", week: "2026-W02", stage: "top5", score: 44 },
    { entity: entityKey, timestamp: "2026-01-15T12:00:00Z", week: "2026-W03", stage: "top5", score: 48 },
    { entity: entityKey, timestamp: "2026-01-22T12:00:00Z", week: "2026-W04", stage: "top5", score: 52 },
  ];
  const noHist = computeTrendConvergence(t, { historyEntries: [] });
  const withHist = computeTrendConvergence(t, { historyEntries: history });
  assert.ok(withHist.persistenceScore > noHist.persistenceScore);
  assert.ok(withHist.convergenceScore >= noHist.convergenceScore);
});

test("sanitizePublicConvergenceCopy scrubs leaked diagnostic phrasing", () => {
  const raw =
    "convergence score 72, persistence score 40, source diversity high, manual proxy tags, the pipeline, trend candidate, normalized places";
  const out = sanitizePublicConvergenceCopy(raw, { redditApprovedForPublicCopy: false });
  assert.ok(!/persistence score/i.test(out));
  assert.ok(!/source diversity/i.test(out));
  assert.ok(!/manual proxy/i.test(out));
  assert.ok(!/\bthe pipeline\b/i.test(out));
  assert.ok(!/trend candidate/i.test(out));
  assert.ok(!/normalized places/i.test(out));
});

test("sanitizePublicConvergenceCopy never exposes Google Places or Reddit naming", () => {
  const out = sanitizePublicConvergenceCopy("Seen on Google Places; buzz on Reddit r/LAFood", {
    redditApprovedForPublicCopy: false,
  });
  assert.ok(!/google places/i.test(out));
  assert.ok(!/\breddit\b/i.test(out));
  assert.match(out, /restaurant listings/i);
  assert.match(out, /food forums/i);
});

test("public narrative never includes Google Places; strongestSources stays raw for admin", () => {
  const t = baseTrend({
    name: "Maps Cluster Dish",
    sources: ["LA Times", "Eater LA"],
    neighborhoods: ["Silver Lake", "Echo Park"],
    evidenceSummary: "Cluster",
    restaurants: [
      { name: "A", neighborhood: "Silver Lake", googleMapsUrl: "https://maps.google.com/?q=a" },
      { name: "B", neighborhood: "Echo Park", googleMapsUrl: "https://maps.google.com/?q=b" },
    ],
  });
  const p = buildPersistedTrendConvergence(t, [], "2026-03-01T12:00:00Z");
  assert.ok(p.strongestSources.includes("Google Places"));
  const blob = [p.publicNarrative.primaryLine, ...p.publicNarrative.supportingLines].join(" ");
  assert.ok(!/google places/i.test(blob));
});

test("public narrative does not include Reddit while connector is stubbed; Reddit still in strongestSources", () => {
  const t = baseTrend({
    name: "Forum Whisper Toast",
    sources: ["LA Times", "reddit.com/r/FoodLosAngeles"],
    neighborhoods: ["Venice", "Santa Monica"],
    restaurants: [
      { name: "R1", neighborhood: "Venice" },
      { name: "R2", neighborhood: "Santa Monica" },
    ],
  });
  const p = buildPersistedTrendConvergence(t, [], "2026-03-01T12:00:00Z");
  assert.ok(p.strongestSources.includes("Reddit"));
  const blob = [p.publicNarrative.primaryLine, ...p.publicNarrative.supportingLines].join(" ");
  assert.ok(!/\breddit\b/i.test(blob));
});

test("when Reddit is approved for public copy, forum texture line appears and still avoids Reddit branding", () => {
  const t = baseTrend({
    name: "Approved Forum Glint",
    neighborhoods: ["Pasadena"],
    restaurants: [{ name: "X", neighborhood: "Pasadena" }],
  });
  const conv: TrendConvergence = {
    trendId: t.id,
    convergenceScore: 50,
    confidence: "medium",
    sourceCount: 3,
    sourceDiversity: 40,
    neighborhoodCount: 1,
    geoSpreadScore: 30,
    persistenceScore: 20,
    socialAlignmentScore: 10,
    editorialAlignmentScore: 40,
    reservationMomentumScore: 0,
    placeDensityScore: 20,
    reasons: [],
    strongestSources: ["LA Times", "Reddit"],
    trendState: "emerging",
  };
  const { primaryLine, supportingLines } = buildPublicConvergenceNarrative(t, conv, {
    redditApprovedForPublicCopy: true,
  });
  const blob = [primaryLine, ...supportingLines].join(" ");
  assert.ok(!/\breddit\b/i.test(blob));
  assert.ok(supportingLines.some((s) => /forums/i.test(s)));
});

test("low-confidence public primary uses warmer wave phrasing", () => {
  const t = baseTrend({
    name: "Quiet Bite",
    neighborhoods: [],
    restaurants: [],
  });
  const conv: TrendConvergence = {
    trendId: t.id,
    convergenceScore: 22,
    confidence: "low",
    sourceCount: 1,
    sourceDiversity: 12,
    neighborhoodCount: 0,
    geoSpreadScore: 10,
    persistenceScore: 10,
    socialAlignmentScore: 0,
    editorialAlignmentScore: 0,
    reservationMomentumScore: 0,
    placeDensityScore: 5,
    reasons: [],
    strongestSources: ["Listings"],
    trendState: "weak_signal",
  };
  const { primaryLine } = buildPublicConvergenceNarrative(t, conv);
  assert.match(primaryLine, /worth watching/i);
  assert.match(primaryLine, /full-on wave/i);
});

test("persisted convergence bundles narratives for disk", () => {
  const t = baseTrend({
    name: "Wine Bar Beat",
    sources: ["LA Times", "Eater LA"],
    neighborhoods: ["Silver Lake", "Echo Park"],
    evidenceSummary: "Cluster",
    restaurants: [
      { name: "A", neighborhood: "Silver Lake", googleMapsUrl: "https://maps.google.com/?q=a" },
      { name: "B", neighborhood: "Echo Park" },
    ],
  });
  const p = buildPersistedTrendConvergence(t, [], "2026-03-01T12:00:00Z");
  assert.ok(typeof p.convergenceScore === "number");
  assert.ok(p.publicNarrative.primaryLine.length > 20);
  assert.ok(Array.isArray(p.whyItsEverywhereNarrative.supportReasons));
  assert.match(p.computedAt, /2026/);
});
