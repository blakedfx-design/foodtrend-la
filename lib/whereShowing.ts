import type { WherePick } from "@/components/foodtrend/wherePick";

const chiliPicks: readonly WherePick[] = [
  { restaurant: "Sqirl", neighborhood: "Virgil Village", dish: "Soft Scramble + Chili Crisp" },
  { restaurant: "HomeState", neighborhood: "Highland Park", dish: "Breakfast Rice Bowl" },
  { restaurant: "Café Telegrama", neighborhood: "Glassell Park", dish: "Chili Crisp Eggs" },
  { restaurant: "Eastside breakfast counters", neighborhood: "East LA", dish: "Chili crisp breakfast burrito" },
];

/** Curated picks keyed by JSON / report `trend_name`. */
export const WHERE_SHOWING_PICKS: Record<string, readonly WherePick[]> = {
  "Thick Burgers": [
    { restaurant: "Dunsmoor", neighborhood: "Mid-City", dish: "Dunsmoor Burger" },
    { restaurant: "The Benjamin", neighborhood: "Hollywood", dish: "Benjamin Burger" },
    { restaurant: "Bar Sinizki", neighborhood: "West Hollywood", dish: "Oklahoma Smash" },
    { restaurant: "Camélia", neighborhood: "Arts District", dish: "Thick Patty Burger" },
  ],
  "Izakayas Everywhere": [
    { restaurant: "Kato", neighborhood: "Arts District", dish: "Hamachi Crudo" },
    { restaurant: "Ototo", neighborhood: "Echo Park", dish: "Chicken Karaage" },
    { restaurant: "Budonoki", neighborhood: "Little Tokyo", dish: "Hand Roll Set" },
  ],
  "Reimagined Bagels": [
    { restaurant: "Smögen", neighborhood: "West Adams", dish: "Stuffed everything bagel" },
    { restaurant: "Red Room", neighborhood: "Hollywood", dish: "Chef's seasonal bagel" },
  ],
  "Chili Crisp Breakfast Burritos": chiliPicks,
  "Chili Crisp Breakfasts": chiliPicks,
  "Slow-Fermented Bagels": [
    { restaurant: "Neighborhood bakehouses", neighborhood: "Across LA", dish: "Long-ferment sourdough ring" },
    { restaurant: "Farmers market bagel stalls", neighborhood: "Weekends", dish: "Blistered sesame bagel" },
  ],
  "Fermented Everything": [
    { restaurant: "Bestia", neighborhood: "Arts District", dish: "Fermented Carrot" },
    { restaurant: "Kismet", neighborhood: "Los Feliz", dish: "Koji Butter" },
    { restaurant: "Mother Wolf", neighborhood: "Hollywood", dish: "Fermented Garlic Dip" },
  ],
  "Snacks Are the New Starters": [
    { restaurant: "Petit Trois", neighborhood: "Hollywood", dish: "Gougères" },
    { restaurant: "Republique", neighborhood: "Mid-Wilshire", dish: "Focaccia + Dip" },
    { restaurant: "Courage Bagels", neighborhood: "Silver Lake", dish: "Market Pickles" },
  ],
  "Korean Ssam Bar Snacks": [
    {
      restaurant: "Dan Sung Sa",
      neighborhood: "Koreatown",
      dish: "Late-night skewers, pajun, lettuce-wrap anju — soju on the table, plates never stop",
    },
    {
      restaurant: "Jilli",
      neighborhood: "Koreatown",
      dish: "Modern Korean anju — ssam-ready bites, chilled pours, built for passing and wrapping",
    },
    {
      restaurant: "Yangban Society",
      neighborhood: "Arts District",
      dish: "Composed ssam set — pork belly, perilla, ssamjang; polish when you want structure",
    },
  ],
  "Aguachile on Ice": [
    {
      restaurant: "Holbox",
      neighborhood: "Downtown LA",
      dish: "Shrimp aguachile verde — heavy lime, serrano heat, sliced cucumber, served ice-cold with tostadas.",
    },
    {
      restaurant: "Coni'Seafood",
      neighborhood: "Inglewood",
      dish: "Shrimp aguachile negro, fresh-milled tostadas, lime wedges you squeeze until your fingers sting",
    },
    {
      restaurant: "Mariscos Jalisco",
      neighborhood: "Boyle Heights",
      dish: "Shrimp aguachile-style tostada — lime-forward, ice-cold, eaten at the truck counter",
    },
  ],
  "Natural Wine \u201cMartini\u201d Hour": [
    {
      restaurant: "Bar Bandini",
      neighborhood: "Echo Park",
      dish: "Skin-contact white or chilled red — served cold, slightly cloudy, poured fast and refilled often",
    },
    {
      restaurant: "Tabula Rasa",
      neighborhood: "Silver Lake",
      dish: "Skin-contact white or chilled red — served cold, slightly cloudy, poured fast and refilled often",
    },
    {
      restaurant: "Donna's",
      neighborhood: "Echo Park",
      dish: "Martini-apertivo pacing with natural pours — early seat, low lights, neighborhood room",
    },
  ],
};

/** Copy shown after exactly “Most spotted: ” (leading phrase fixed in UI). */
const MOST_SPOTTED_REST: Record<string, string> = {
  "Thick Burgers": "Bar Sinizki (WeHo) — Oklahoma Smash",
  "Izakayas Everywhere": "Kato (Arts District) — Hamachi Crudo",
  "Reimagined Bagels": "Red Room (Hollywood) — Chef's seasonal bagel",
  "Chili Crisp Breakfast Burritos": "HomeState (Highland Park) — Breakfast Rice Bowl",
  "Chili Crisp Breakfasts": "HomeState (Highland Park) — Breakfast Rice Bowl",
  "Slow-Fermented Bagels": "Farmers market bagel stalls (Weekends) — Blistered sesame bagel",
  "Fermented Everything": "Bestia (Arts District) — Fermented Carrot",
  "Snacks Are the New Starters": "Courage Bagels (Silver Lake) — Market Pickles",
  "Korean Ssam Bar Snacks":
    "Dan Sung Sa (Koreatown)\nJilli (Koreatown)\nYangban Society (Arts District)",
  "Aguachile on Ice":
    "Holbox (Downtown LA) — Shrimp aguachile verde — heavy lime, serrano heat, sliced cucumber, served ice-cold with tostadas.",
  "Natural Wine \u201cMartini\u201d Hour":
    "Bar Bandini (Echo Park); Tabula Rasa (Silver Lake); Donna's (Echo Park)",
};

/** Copy after exactly “Worth the splurge: ” */
const WORTH_SPLURGE_REST: Record<string, string> = {
  "Thick Burgers": "Camélia (Arts District) — Thick Patty Burger",
  "Izakayas Everywhere": "Budonoki (Little Tokyo) — Hand Roll Set",
  "Reimagined Bagels": "Red Room (Hollywood) — Chef's seasonal bagel",
  "Chili Crisp Breakfast Burritos": "Sqirl (Virgil Village) — Soft Scramble + Chili Crisp",
  "Chili Crisp Breakfasts": "Sqirl (Virgil Village) — Soft Scramble + Chili Crisp",
  "Slow-Fermented Bagels": "Neighborhood bakehouses (Across LA) — Long-ferment sourdough ring",
  "Fermented Everything": "Mother Wolf (Hollywood) — Fermented Garlic Dip",
  "Snacks Are the New Starters": "Petit Trois (Hollywood) — Gougères",
  "Korean Ssam Bar Snacks": "Yangban Society — bigger spread, more composed plates",
  "Aguachile on Ice": "Holbox — pristine seafood, deeper citrus, cleaner heat.",
  "Natural Wine \u201cMartini\u201d Hour":
    "Bar Bandini (Echo Park) — deeper list, more interesting pours, slower vibe",
};

/** Copy after exactly “Easy entry: ” */
const EASY_ENTRY_REST: Record<string, string> = {
  "Thick Burgers": "Dunsmoor (Mid-City) — Dunsmoor Burger",
  "Izakayas Everywhere": "Ototo (Echo Park) — Chicken Karaage",
  "Reimagined Bagels": "Smögen (West Adams) — Stuffed everything bagel",
  "Chili Crisp Breakfast Burritos": "Café Telegrama (Glassell Park) — Chili Crisp Eggs",
  "Chili Crisp Breakfasts": "Café Telegrama (Glassell Park) — Chili Crisp Eggs",
  "Slow-Fermented Bagels": "Farmers market bagel stalls (Weekends) — Blistered sesame bagel",
  "Fermented Everything": "Kismet (Los Feliz) — Koji Butter",
  "Snacks Are the New Starters": "Republique (Mid-Wilshire) — Focaccia + Dip",
  "Korean Ssam Bar Snacks": "Dan Sung Sa — late-night anju bar energy, endless small plates to wrap",
  "Aguachile on Ice": "Mariscos Jalisco — faster, louder, and just as craveable.",
  "Natural Wine \u201cMartini\u201d Hour":
    "Tabula Rasa (Silver Lake) — approachable, louder, easy to slide into",
};

function pickRestLine(pick: WherePick): string {
  const hood =
    pick.neighborhood === "West Hollywood"
      ? "WeHo"
      : pick.neighborhood.length > 14
        ? pick.neighborhood.split(/[\s/]/)[0] ?? pick.neighborhood
        : pick.neighborhood;
  return `${pick.restaurant} (${hood}) — ${pick.dish}`;
}

export function getMostSpottedRestLine(trendName: string, fallbackPick?: WherePick): string {
  const curated = MOST_SPOTTED_REST[trendName];
  if (curated) return curated;
  const picks = WHERE_SHOWING_PICKS[trendName];
  const first = picks?.[0] ?? fallbackPick;
  if (first) return pickRestLine(first);
  return "—";
}

export function getSplurgeRestLine(trendName: string, picks: WherePick[]): string {
  const curated = WORTH_SPLURGE_REST[trendName];
  if (curated) return curated;
  if (picks.length >= 2) return pickRestLine(picks[picks.length - 1]!);
  if (picks.length === 1) return pickRestLine(picks[0]!);
  return "—";
}

export function getEntryRestLine(trendName: string, picks: WherePick[]): string {
  const curated = EASY_ENTRY_REST[trendName];
  if (curated) return curated;
  if (picks.length >= 2) return pickRestLine(picks[0]!);
  if (picks.length === 1) return pickRestLine(picks[0]!);
  return "—";
}

export function dishFallbackLabel(trendName: string, definition?: string, emerging?: string) {
  const e = emerging?.trim();
  if (e) return e.length <= 90 ? e : `${e.slice(0, 87)}…`;
  const d = definition?.trim();
  if (d) {
    const first = d.split(/(?<=[.!?])\s+/)[0]?.trim() ?? d;
    const shortened = first.length > 85 ? `${first.slice(0, 82)}…` : first;
    return shortened.endsWith(".") ? shortened : `${shortened}.`;
  }
  return `Standout ${trendName} on menus`;
}

export function getWherePicks(
  trendName: string,
  venues: string[],
  opts: { definition?: string; emergingDish?: string },
): WherePick[] {
  const curated = WHERE_SHOWING_PICKS[trendName];
  if (curated?.length) return [...curated];
  const dish = dishFallbackLabel(trendName, opts.definition, opts.emergingDish);
  if (!venues.length) return [{ restaurant: "—", neighborhood: "LA", dish }];
  return venues.map((v) => ({ restaurant: v, neighborhood: "LA", dish }));
}
