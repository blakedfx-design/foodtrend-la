/**
 * FoodTrendLA — connected agent pipeline (single script, no agent framework).
 *
 * 1. Scout Agent       → raw candidate dish signals + sources (LLM + web search)
 * 2. Validation Agent  → drop invalid / generic / duplicates (rules + overlap dedupe)
 * 3. Trend Engine      → deterministic scores & Top 5 / Top 3 split (lib/trendEngine.ts)
 * 4. Editorial Agent   → punchy dish-first copy on final cards (LLM, preserves ranks/scores/sources)
 */

import fs from "node:fs/promises";
import path from "node:path";
import OpenAI from "openai";
import { buildFoodTrendsFromCandidates, dedupeOverlappingCandidates } from "../lib/trendEngine";
import type { AboutToHitTrend, DishTrendCandidate, FoodTrendsPayload } from "../types/trend";
import {
  DEFAULT_SOURCE,
  autoEvidenceFromRestaurants,
  dedupeVenues,
  normalizeDishCandidate,
  normalizeVenue,
} from "../lib/validateTrend";

const MODEL = "gpt-4.1-mini";
const ROOT_DIR = process.cwd();
const ENV_FILE = path.resolve(ROOT_DIR, ".env.local");
const OUTPUT_FILE = path.resolve(process.cwd(), "data/la-food-trends.json");

/** Scout output band */
const SCOUT_MIN = 15;
const SCOUT_MAX = 25;

/** Pull extra signals if validation thins the pool */
const VALIDATION_FLOOR = 12;

const candidateItemSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    trend_name: { type: "string", minLength: 8, maxLength: 72 },
    definition: { type: "string", minLength: 24, maxLength: 220 },
    representative_restaurants: {
      type: "array",
      minItems: 2,
      maxItems: 8,
      items: { type: "string" },
    },
    evidence_of_spread: { type: "string", minLength: 0, maxLength: 320 },
    why_hot: { type: "string", minLength: 24, maxLength: 220 },
    sources: {
      type: "array",
      minItems: 1,
      maxItems: 2,
      items: {
        type: "string",
        pattern: "^https?://",
      },
    },
  },
  required: [
    "trend_name",
    "definition",
    "representative_restaurants",
    "evidence_of_spread",
    "why_hot",
    "sources",
  ],
} as const;

const scoutCandidatesSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    candidates: {
      type: "array",
      minItems: SCOUT_MIN,
      maxItems: SCOUT_MAX,
      items: candidateItemSchema,
    },
  },
  required: ["candidates"],
} as const;

const editorialRightNowItemSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    rank: { type: "integer", minimum: 1, maximum: 5 },
    trend_name: { type: "string", minLength: 8, maxLength: 72 },
    definition: { type: "string", minLength: 24, maxLength: 220 },
    representative_restaurants: {
      type: "array",
      minItems: 2,
      maxItems: 6,
      items: { type: "string" },
    },
    evidence_of_spread: { type: "string", minLength: 0, maxLength: 280 },
    why_hot: { type: "string", minLength: 24, maxLength: 220 },
    trend_score: { type: "number", minimum: 0, maximum: 100 },
    trend_stage: {
      type: "string",
      enum: ["Rising", "Peak"],
    },
    go_now_recommendation: { type: "string", maxLength: 200 },
    sources: {
      type: "array",
      minItems: 1,
      maxItems: 2,
      items: { type: "string", pattern: "^https?://" },
    },
  },
  required: [
    "rank",
    "trend_name",
    "definition",
    "representative_restaurants",
    "evidence_of_spread",
    "why_hot",
    "trend_score",
    "trend_stage",
    "go_now_recommendation",
    "sources",
  ],
} as const;

const editorialAboutItemSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    rank: { type: "integer", minimum: 1, maximum: 3 },
    trend_name: { type: "string", minLength: 12, maxLength: 80 },
    emerging_dish_or_item: { type: "string", minLength: 8, maxLength: 120 },
    early_places_to_watch: {
      type: "array",
      minItems: 2,
      maxItems: 4,
      items: { type: "string" },
    },
    why_it_could_pop: { type: "string", minLength: 20, maxLength: 220 },
    watch_signal: { type: "string", minLength: 12, maxLength: 160 },
    trend_score: { type: "number", minimum: 0, maximum: 100 },
    trend_stage: {
      type: "string",
      const: "Emerging",
    },
    sources: {
      type: "array",
      minItems: 1,
      maxItems: 2,
      items: { type: "string", pattern: "^https?://" },
    },
  },
  required: [
    "rank",
    "trend_name",
    "emerging_dish_or_item",
    "why_it_could_pop",
    "early_places_to_watch",
    "watch_signal",
    "trend_score",
    "trend_stage",
    "sources",
  ],
} as const;

const editorialPayloadSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    right_now_section_title: {
      type: "string",
      const: "Top 5 LA Food Trends Right Now",
    },
    about_to_hit_section_title: {
      type: "string",
      const: "Top 3 About to Hit",
    },
    right_now: {
      type: "array",
      minItems: 5,
      maxItems: 5,
      items: editorialRightNowItemSchema,
    },
    about_to_hit: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: editorialAboutItemSchema,
    },
  },
  required: [
    "right_now_section_title",
    "about_to_hit_section_title",
    "right_now",
    "about_to_hit",
  ],
} as const;

function stripWrappingQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

async function readApiKeyFromEnvLocal(): Promise<string> {
  const envRaw = await fs.readFile(ENV_FILE, "utf-8");
  const lines = envRaw.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    if (trimmed.startsWith("OPENAI_API_KEY=")) {
      const value = trimmed.slice("OPENAI_API_KEY=".length);
      const apiKey = stripWrappingQuotes(value);
      if (!apiKey) {
        break;
      }
      return apiKey;
    }
  }

  throw new Error("OPENAI_API_KEY was not found in .env.local");
}

function fallbackRightNowToCandidate(row: {
  trend_name: string;
  definition: string;
  representative_restaurants: string[];
  evidence_of_spread: string;
  why_hot: string;
  sources: string[];
}): DishTrendCandidate {
  const venues = dedupeVenues(row.representative_restaurants);
  return {
    trend_name: row.trend_name,
    definition: row.definition,
    representative_restaurants: venues,
    evidence_of_spread:
      row.evidence_of_spread.trim() || autoEvidenceFromRestaurants(venues),
    why_hot: row.why_hot,
    sources: row.sources,
  };
}

function fallbackAboutToCandidate(row: Omit<AboutToHitTrend, "rank">): DishTrendCandidate {
  const venues = dedupeVenues(row.early_places_to_watch);
  const definition = `${row.emerging_dish_or_item} ${row.why_it_could_pop}`;
  const clipped =
    definition.length <= 220 ? definition : `${definition.slice(0, 217)}...`;
  const evidence =
    row.watch_signal.trim().length >= 24
      ? row.watch_signal.trim()
      : autoEvidenceFromRestaurants(venues);

  return {
    trend_name: row.trend_name,
    definition: clipped.length >= 24 ? clipped : `${row.trend_name} — ${row.emerging_dish_or_item}`,
    representative_restaurants: venues,
    evidence_of_spread: evidence,
    why_hot:
      row.why_it_could_pop.trim().length >= 24
        ? row.why_it_could_pop.trim()
        : "Early LA menu experiments are testing this format before it widens.",
    sources: row.sources,
  };
}

const FALLBACK_RIGHT_NOW_ROWS = [
  {
    trend_name: "Chili Crisp Breakfast Burritos",
    definition:
      "Breakfast burritos finished with chili crisp or chili oil for heat and crunch, showing up beyond traditional Mexican spots.",
    representative_restaurants: ["Eastside breakfast counters", "Westside brunch cafes"],
    evidence_of_spread: "",
    why_hot: "Chili crisp crossed into breakfast as diners want savory heat early in the day.",
    sources: [DEFAULT_SOURCE],
  },
  {
    trend_name: "Slow-Fermented Bagels",
    definition:
      "Long-ferment dough bagels with chew and blister—often sourdough or hybrid—sold at specialty bakeries and weekend pop-ups.",
    representative_restaurants: ["Neighborhood bakehouses", "Farmers market bagel stalls"],
    evidence_of_spread: "",
    why_hot: "LA’s bakery wave pushed craft bagels with serious fermentation and texture.",
    sources: [DEFAULT_SOURCE],
  },
  {
    trend_name: "Matcha Pistachio Pastries",
    definition:
      "Pastries and desserts pairing grassy matcha with pistachio—croissants, danishes, and layered cakes.",
    representative_restaurants: ["Artisan pastry shops", "Specialty dessert cafes"],
    evidence_of_spread: "",
    why_hot: "Social-forward desserts keep merging trendy flavors for shareable slices.",
    sources: [DEFAULT_SOURCE],
  },
  {
    trend_name: "Crispy Rice Salads",
    definition:
      "Salads using fried or toasted rice for crunch—often broken tartare-style bites or puffed grains on greens.",
    representative_restaurants: ["New American kitchens", "Asian-inspired casual dining"],
    evidence_of_spread: "",
    why_hot: "Chefs add texture hooks that read well on menus and camera.",
    sources: [DEFAULT_SOURCE],
  },
  {
    trend_name: "Japanese Egg Salad Sandos",
    definition:
      "Soft milk bread sandwiches centered on jammy egg salad—often with katsu or fruit variants nearby on the same menus.",
    representative_restaurants: ["Japanese cafes", "Fusion lunch counters"],
    evidence_of_spread: "",
    why_hot: "Portable, neat layers make sandos an easy trend for daytime menus.",
    sources: [DEFAULT_SOURCE],
  },
];

const FALLBACK_ABOUT_ROWS: Omit<AboutToHitTrend, "rank">[] = [
  {
    trend_name: "Cloud Focaccia Snacking",
    emerging_dish_or_item: "Ultra-airy focaccia sheets meant for tearing and dipping.",
    early_places_to_watch: ["Weekend bakery lines", "Wine bar snack menus"],
    why_it_could_pop: "Bread-as-snack formats keep iterating; cloud focaccia is the next texture flex.",
    watch_signal: "More IG clips of pull-apart focaccia boards at LA openings.",
    trend_score: 58,
    trend_stage: "Emerging",
    sources: [DEFAULT_SOURCE],
  },
  {
    trend_name: "Filipino BBQ Skewer Nights",
    emerging_dish_or_item: "Sweet-savory skewer platters with calamansi and garlic rice bundles.",
    early_places_to_watch: ["Outdoor patio grills", "Night market pop-ups"],
    why_it_could_pop: "Family-style skewer spreads travel well for patio dining and events.",
    watch_signal: "Repeat Filipino BBQ features on seasonal LA food roundups.",
    trend_score: 55,
    trend_stage: "Emerging",
    sources: [DEFAULT_SOURCE],
  },
  {
    trend_name: "Dubai Chocolate Dessert Bars",
    emerging_dish_or_item:
      "Kataifi-filled chocolate bars with pistachio cream—viral dessert format landing on pastry menus.",
    early_places_to_watch: ["Trend-forward chocolatiers", "Dessert-focused cafes"],
    why_it_could_pop: "Viral dessert formats migrate quickly into LA pastry cases.",
    watch_signal: "Menu drops referencing Dubai-style chocolate bars at multiple shops.",
    trend_score: 52,
    trend_stage: "Emerging",
    sources: [DEFAULT_SOURCE],
  },
];

const FALLBACK_DISH_CANDIDATES: DishTrendCandidate[] = [
  ...FALLBACK_RIGHT_NOW_ROWS.map(fallbackRightNowToCandidate),
  ...FALLBACK_ABOUT_ROWS.map(fallbackAboutToCandidate),
];

function parseCandidates(record: Record<string, unknown>): unknown[] {
  const raw = record.candidates;
  return Array.isArray(raw) ? raw : [];
}

// -----------------------------------------------------------------------------
// Stage 1 — Scout Agent
// -----------------------------------------------------------------------------

async function stageScoutAgent(client: OpenAI): Promise<unknown[]> {
  const prompt = `Use public web sources only (Los Angeles food). Do not use private, logged-in, or paywalled pages.

You are the SCOUT AGENT. Collect ${SCOUT_MIN}–${SCOUT_MAX} candidate LA dish/item TRENDS (shared patterns across multiple places where credible).

Output ONLY a flat JSON object: { "candidates": [ ... ] }. No ranks, scores, or stages.

Rules:
- trend_name = specific dish/build (Title Case). Never a venue name alone or a vague category ("best burgers", "izakayas everywhere").
- representative_restaurants: ≥2 DISTINCT LA-area examples (real names or tight descriptors).
- evidence_of_spread: why this is not single-restaurant hype (multi-venue cues). Use "" only if the venue list alone proves spread.
- why_hot: menu/diner momentum; no ambiance/service review fluff.
- sources: 1–2 https URLs per candidate from your search.

Return between ${SCOUT_MIN} and ${SCOUT_MAX} candidates (inclusive).`;

  let record: Record<string, unknown> = {};

  try {
    const response = await client.responses.create({
      model: MODEL,
      tools: [{ type: "web_search" as never }],
      input: prompt,
      text: {
        format: {
          type: "json_schema",
          name: "la_food_scout_candidates",
          strict: true,
          schema: scoutCandidatesSchema as unknown as Record<string, unknown>,
        },
      },
    });

    const text = response.output_text ?? "{}";
    record = JSON.parse(text) as Record<string, unknown>;
  } catch {
    record = {};
  }

  return parseCandidates(record);
}

async function scoutTopUpCandidates(
  client: OpenAI,
  count: number,
  excludeLabels: string[],
): Promise<unknown[]> {
  if (count <= 0) {
    return [];
  }

  const n = Math.min(SCOUT_MAX, Math.max(1, count));

  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      candidates: {
        type: "array",
        minItems: n,
        maxItems: n,
        items: candidateItemSchema,
      },
    },
    required: ["candidates"],
  } as const;

  const prompt = `Los Angeles food — public sources only.

SCOUT AGENT top-up: return exactly ${n} NEW dish/item trend candidates (same fields as main scout). No ranks or scores.

Avoid near-duplicates of: ${excludeLabels.length ? excludeLabels.join("; ") : "(none)"}.

JSON only: { "candidates": [ ... ] }.`;

  try {
    const response = await client.responses.create({
      model: MODEL,
      tools: [{ type: "web_search" as never }],
      input: prompt,
      text: {
        format: {
          type: "json_schema",
          name: "la_food_scout_topup",
          strict: true,
          schema: schema as unknown as Record<string, unknown>,
        },
      },
    });

    const text = response.output_text ?? "{}";
    const parsed = JSON.parse(text) as { candidates?: unknown[] };
    return Array.isArray(parsed.candidates) ? parsed.candidates : [];
  } catch {
    return [];
  }
}

// -----------------------------------------------------------------------------
// Stage 2 — Validation Agent (rules + dedupe; no extra framework)
// -----------------------------------------------------------------------------

function stageValidationAgent(rawRows: unknown[]): DishTrendCandidate[] {
  const normalized = rawRows
    .map(normalizeDishCandidate)
    .filter((x): x is DishTrendCandidate => x !== null);

  return dedupeOverlappingCandidates(normalized);
}

// -----------------------------------------------------------------------------
// Stage 3 — Trend Engine (deterministic; implemented in lib/trendEngine.ts)
// -----------------------------------------------------------------------------

function stageTrendEngine(candidates: DishTrendCandidate[]): FoodTrendsPayload {
  return buildFoodTrendsFromCandidates(candidates);
}

// -----------------------------------------------------------------------------
// Stage 4 — Editorial Agent
// -----------------------------------------------------------------------------

function reconcileEditorial(base: FoodTrendsPayload, edited: FoodTrendsPayload): FoodTrendsPayload {
  if (
    edited.right_now.length !== base.right_now.length ||
    edited.about_to_hit.length !== base.about_to_hit.length
  ) {
    return base;
  }

  return {
    right_now_section_title: base.right_now_section_title,
    about_to_hit_section_title: base.about_to_hit_section_title,
    right_now: edited.right_now.map((row, i) => ({
      ...row,
      rank: base.right_now[i].rank,
      trend_score: base.right_now[i].trend_score,
      trend_stage: base.right_now[i].trend_stage,
      representative_restaurants: base.right_now[i].representative_restaurants,
      sources: base.right_now[i].sources,
      go_now_recommendation: row.go_now_recommendation ?? "",
    })),
    about_to_hit: edited.about_to_hit.map((row, i) => ({
      ...row,
      rank: base.about_to_hit[i].rank,
      trend_score: base.about_to_hit[i].trend_score,
      trend_stage: "Emerging",
      early_places_to_watch: base.about_to_hit[i].early_places_to_watch,
      sources: base.about_to_hit[i].sources,
    })),
  };
}

async function stageEditorialAgent(
  client: OpenAI,
  payload: FoodTrendsPayload,
): Promise<FoodTrendsPayload> {
  if (payload.right_now.length < 5 || payload.about_to_hit.length < 3) {
    return payload;
  }

  const prompt = `You are the EDITORIAL AGENT for LA food trend cards.

Input JSON (engine output — ranks/scores/stages are authoritative):
${JSON.stringify(payload)}

Task: Rewrite prose to be punchy, tight, and dish-first. Lead with what’s on the plate, not vibe.

Hard constraints:
- Preserve section titles exactly as given.
- Preserve each card’s rank, trend_score, and trend_stage exactly.
- Preserve representative_restaurants and early_places_to_watch arrays EXACTLY (same strings, same order).
- Preserve sources arrays EXACTLY (same URLs, same order).
- You MAY rewrite: trend_name (stay Title Case dish pattern), definition, evidence_of_spread, why_hot, go_now_recommendation (may stay empty string).
- For about_to_hit you MAY rewrite: trend_name, emerging_dish_or_item, why_it_could_pop, watch_signal.

Output JSON matching the schema only.`;

  try {
    const response = await client.responses.create({
      model: MODEL,
      input: prompt,
      text: {
        format: {
          type: "json_schema",
          name: "la_food_editorial",
          strict: true,
          schema: editorialPayloadSchema as unknown as Record<string, unknown>,
        },
      },
    });

    const text = response.output_text ?? "{}";
    const edited = JSON.parse(text) as FoodTrendsPayload;
    return reconcileEditorial(payload, edited);
  } catch {
    return payload;
  }
}

// -----------------------------------------------------------------------------

async function scoutTrends(): Promise<void> {
  const apiKey = await readApiKeyFromEnvLocal();
  const client = new OpenAI({ apiKey });

  console.log("[1/4] Scout Agent — collecting candidates…");
  let raw = await stageScoutAgent(client);
  console.log(`      Scout returned ${raw.length} raw rows`);

  let validated = stageValidationAgent(raw);
  console.log(`[2/4] Validation Agent — ${validated.length} pass rules + dedupe`);

  if (validated.length < VALIDATION_FLOOR) {
    const exclude = [...new Set(validated.map((c) => normalizeVenue(c.trend_name)))].filter(Boolean);
    const need = Math.max(1, VALIDATION_FLOOR - validated.length + 6);
    console.log(`      Thin pool — scout top-up (${need})…`);
    const extraRaw = await scoutTopUpCandidates(client, need, exclude);
    validated = stageValidationAgent([...raw, ...extraRaw]);
    console.log(`      After top-up: ${validated.length} validated`);
    raw = [...raw, ...extraRaw];
  }

  const candidates = validated;

  console.log("[3/4] Trend Engine — deterministic rank & split…");
  let payload = stageTrendEngine(candidates);

  if (payload.right_now.length < 5 || payload.about_to_hit.length < 3) {
    console.log("      Engine short — merging fallback dish candidates…");
    payload = stageTrendEngine([...candidates, ...FALLBACK_DISH_CANDIDATES]);
  }

  console.log("[4/4] Editorial Agent — dish-first copy pass…");
  payload = await stageEditorialAgent(client, payload);

  await fs.writeFile(OUTPUT_FILE, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");
  console.log(
    `Done — wrote ${payload.right_now.length} right_now, ${payload.about_to_hit.length} about_to_hit → ${OUTPUT_FILE}`,
  );
}

scoutTrends().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
