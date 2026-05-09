import { normalizeEntity } from "@/lib/signals/normalizeEntity";
import type { SignalEntityType } from "@/lib/signals/types";

export type EditorialLexiconCategory =
  | "dish"
  | "cuisine"
  | "ingredient"
  | "restaurant_format"
  | "dining_behavior"
  | "neighborhood";

export type EditorialLexiconEntry = {
  term: string;
  normalized: string;
  entityType: SignalEntityType;
  category: EditorialLexiconCategory;
  candidateOnly: boolean;
};

export type EditorialLexicon = {
  entries: EditorialLexiconEntry[];
  genericSingleWordTerms: Set<string>;
  neighborhoods: string[];
};

const CANDIDATE_DISH_TERMS = [
  "aguachile",
  "crudo",
  "ceviche",
  "mariscos",
  "hainan chicken",
  "chicken rice",
  "ssam",
  "banchan",
  "inasal",
  "filipino bbq",
  "bbq skewers",
  "skewers",
  "ube",
  "ube cheesecake",
  "basque cheesecake",
  "olive oil cake",
  "natural wine martini",
  "martini hour",
  "sonoran breakfast burrito",
  "machaca breakfast burrito",
  "breakfast burrito",
  "flour tortilla",
] as const;

const CANDIDATE_CUISINE_TERMS = [
  "sonoran",
  "northern mexican",
  "filipino",
  "korean",
  "armenian",
] as const;

const CANDIDATE_INGREDIENT_TERMS = [
  "machaca",
  "ube",
  "calamansi",
  "vinegar",
  "perilla",
] as const;

const CANDIDATE_RESTAURANT_FORMAT_TERMS = [
  "wine bar",
  "lunch counter",
  "skewer spot",
  "bakery case",
  "dessert bar",
  "bbq stand",
] as const;

const CANDIDATE_DINING_BEHAVIOR_TERMS = [
  "shared plates",
  "group dining",
  "late night dining",
  "martini hour",
  "counter service",
] as const;

const GENERIC_SINGLE_WORD_TERMS = new Set([
  "korean",
  "mexican",
  "wine",
  "dessert",
  "breakfast",
]);

function toEntry(
  term: string,
  category: EditorialLexiconCategory,
  entityType: SignalEntityType,
  candidateOnly: boolean,
): EditorialLexiconEntry | null {
  const normalized = normalizeEntity(term).trim();
  if (!normalized) return null;
  return { term, normalized, category, entityType, candidateOnly };
}

export function buildEditorialLexicon(input: {
  trendNames: string[];
  menuItems: string[];
  restaurants: string[];
  cuisines: string[];
  neighborhoods: string[];
}): EditorialLexicon {
  const map = new Map<string, EditorialLexiconEntry>();
  const add = (
    term: string,
    category: EditorialLexiconCategory,
    entityType: SignalEntityType,
    candidateOnly: boolean,
  ) => {
    const entry = toEntry(term, category, entityType, candidateOnly);
    if (!entry) return;
    if (!map.has(entry.normalized)) map.set(entry.normalized, entry);
  };

  for (const term of input.trendNames) add(term, "dish", "dish", false);
  for (const term of input.menuItems) add(term, "dish", "dish", false);
  for (const term of input.restaurants) add(term, "restaurant_format", "restaurant", false);
  for (const term of input.cuisines) add(term, "cuisine", "cuisine", false);

  // Aliases mirrored from normalizeEntity phrase replacements.
  add("hainanese chicken rice", "dish", "dish", true);
  add("singapore chicken rice", "dish", "dish", true);
  add("ssam bar snacks", "dish", "dish", true);
  add("sonoran-style breakfast burritos", "dish", "dish", true);
  add("ube basque cheesecake slices", "dish", "dish", true);

  for (const term of CANDIDATE_DISH_TERMS) add(term, "dish", "dish", true);
  for (const term of CANDIDATE_CUISINE_TERMS) add(term, "cuisine", "cuisine", true);
  for (const term of CANDIDATE_INGREDIENT_TERMS) add(term, "ingredient", "ingredient", true);
  for (const term of CANDIDATE_RESTAURANT_FORMAT_TERMS)
    add(term, "restaurant_format", "dish", true);
  for (const term of CANDIDATE_DINING_BEHAVIOR_TERMS) add(term, "dining_behavior", "dish", true);
  for (const hood of input.neighborhoods) add(hood, "neighborhood", "cuisine", true);

  return {
    entries: [...map.values()],
    genericSingleWordTerms: GENERIC_SINGLE_WORD_TERMS,
    neighborhoods: input.neighborhoods.filter(Boolean),
  };
}
