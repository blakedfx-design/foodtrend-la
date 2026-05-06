import type { Trend } from "@/types/laFoodTrend";

/** Uppercase editorial cue: "Table Starter" → "TABLE STARTER". */
function phraseToCue(phrase: string): string | undefined {
  const t = phrase.trim().replace(/\s+/g, " ");
  if (!t || t.length > 48) return undefined;
  return t
    .split(" ")
    .map((w) => w.toUpperCase())
    .join(" ");
}

/**
 * Short meal/moment line above the dish title for scanability.
 * Uses mealMoment → mealType rules → light heuristics from name/description.
 */
export function editorialMealScanLabel(trend: Trend): string | undefined {
  const mealMoment = trend.mealMoment?.trim();
  const mealType = trend.mealType?.trim();
  const blob = `${trend.name}\n${trend.description ?? ""}`.toLowerCase();

  if (mealMoment) {
    const cue = phraseToCue(mealMoment);
    if (cue) return cue;
  }

  if (mealType) {
    const mtl = mealType.toLowerCase();
    if (mtl.includes("cold seafood")) return "TABLE STARTER";
    if (mtl.includes("lunch")) return "LUNCH TREND";
    if (mtl.includes("breakfast")) return "BREAKFAST";
    if (mtl.includes("snack") || mtl.includes("bar bite")) return "DINNER SNACK";
    if (mtl.includes("wine") || mtl.includes("drink") || mtl.includes("aperitif") || mtl.includes("cocktail")) {
      return "APERITIVO";
    }
  }

  if (/\bbreakfast\b|morning burrito|morning wrap|morning line/.test(blob)) return "BREAKFAST";
  if (/\blunch\b|lunch counter|daytime|fast daytime/.test(blob)) return "LUNCH TREND";
  if (/\bwine\b|martini|aperitivo|happy hour|poured like/.test(blob)) return "APERITIVO";
  if (/\bsnacks?\b|ssam|skewer|late dinner|latenight|late-night|patio menu|brewery/.test(blob)) {
    return "DINNER SNACK";
  }
  if (/\baguachile|table starter|raw bar|ceviche/.test(blob)) return "TABLE STARTER";
  if (/\bdessert\b|cheesecake|soft serve|pastry case|basque slice|ube basque/.test(blob)) return "DESSERT";

  return undefined;
}
