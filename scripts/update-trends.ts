/**
 * MVP ingestion entry: simulates pulling real-world signals (no APIs yet),
 * writes `data/la-food-trends.json` in the canonical `LaFoodTrendsDataFile` shape.
 */

import fs from "node:fs/promises";
import { LA_FOOD_TRENDS_DATA_FILE } from "../lib/laFoodTrendsData";
import type { LaFoodTrendsDataFile, Trend } from "../types/laFoodTrend";

const PLACEHOLDER_SOURCES = [
  "Google Maps",
  "Restaurant Menu",
  "Reddit LA",
  "Food Blog",
] as const;

/** Illustrative snapshot only — not verified live menu research. */
function simulatedPrimaryTrends(isoTimestamp: string): Trend[] {
  return [
    {
      id: "korean-ssam-bar-snacks",
      name: "Korean Ssam Bar Snacks",
      description:
        "Lettuce cups, perilla, and ssamjang-led bites on wine-bar and tasting menus—LA’s K-town energy spilling west.",
      whyItsEverywhere:
        "Low-lift share format that pairs with natural wine. Chefs get crunch and heat without full entrée builds.",
      signalScore: 88,
      lastUpdated: isoTimestamp,
      sources: [...PLACEHOLDER_SOURCES],
      neighborhoods: ["Koreatown", "West Hollywood", "Arts District"],
      restaurants: [
        { name: "Yangban Society", neighborhood: "Downtown LA" },
        { name: "Bar Sinizki", neighborhood: "West Hollywood" },
        { name: "Here's Looking At You", neighborhood: "Koreatown" },
      ],
      menuItems: [
        "Perilla ssam with brisket ends",
        "Smoked fish lettuce wraps",
        "Prime short rib ssam kit",
      ],
      confidence: "high",
    },
    {
      id: "sonoran-breakfast-burritos",
      name: "Sonoran-Style Breakfast Burritos",
      description:
        "Flour tortillas, eggs, potato, and crisped machaca-style fills—morning lines stretching outside Highland Park and Boyle Heights pits.",
      whyItsEverywhere:
        "Handheld dayparts stay crowded. Taquerias are trading thin wraps for blistered, heavier builds that survive a car ride.",
      signalScore: 81,
      lastUpdated: isoTimestamp,
      sources: [...PLACEHOLDER_SOURCES],
      neighborhoods: ["Highland Park", "Boyle Heights", "Glassell Park"],
      restaurants: [
        { name: "HomeState", neighborhood: "Highland Park" },
        { name: "Colonia Tacos Guisados", neighborhood: "Boyle Heights" },
        { name: "Cilantro Mexican Grill", neighborhood: "Glassell Park" },
      ],
      menuItems: [
        "Machaca breakfast burrito",
        "Chorizo-potato morning wrap",
        "Bacon-egg blistered tortilla roll",
      ],
      confidence: "medium",
    },
    {
      id: "hainan-chicken-lunch",
      name: "Hainan Chicken Lunch Counters",
      description:
        "Ginger-poached bird, chicken-fat rice, and three-sauce trays popping up as fast daytime platters from Westlake to the SGV.",
      whyItsEverywhere:
        "Price-conscious lunch crowds want something cleaner than fried chicken but still comforting. Counter service keeps turns high.",
      signalScore: 79,
      lastUpdated: isoTimestamp,
      sources: [...PLACEHOLDER_SOURCES],
      neighborhoods: ["Westlake", "Alhambra", "Monterey Park"],
      restaurants: [
        { name: "Side Chick", neighborhood: "Arcadia" },
        { name: "Cluck2Go", neighborhood: "Pasadena" },
        { name: "Savoy Kitchen", neighborhood: "Alhambra" },
      ],
      menuItems: [
        "Half Hainan chicken plate",
        "Crispy chicken skin add-on",
        "Ginger-scallion rice bowl",
      ],
      confidence: "medium",
    },
    {
      id: "aguachile-ice",
      name: "Aguachile on Ice",
      description:
        "Cured shrimp and snapper in chile-lime baths, plated like crudos for patio and martini-hour menus from the Westside to Long Beach.",
      whyItsEverywhere:
        "Heat and acid read clearly on camera. Bars want seafood that feels like a course, not a fryer plate.",
      signalScore: 76,
      lastUpdated: isoTimestamp,
      sources: [...PLACEHOLDER_SOURCES],
      neighborhoods: ["Venice", "Long Beach", "Silver Lake"],
      restaurants: [
        { name: "Holbox", neighborhood: "Downtown LA" },
        { name: "Coni'Seafood", neighborhood: "Inglewood" },
        { name: "Petty Cash Taqueria", neighborhood: "Fairfax" },
      ],
      menuItems: [
        "Shrimp aguachile verde",
        "Snapper aguachile rojo cup",
        "Cucumber-lime chaser flight",
      ],
      confidence: "medium",
    },
    {
      id: "natural-wine-martini-hour",
      name: "Natural Wine “Martini” Hours",
      description:
        "Oxidized pours, salty finos, and vermouth-heavy builds sold as pre-dinner rails—less sweet than brunch spritz culture.",
      whyItsEverywhere:
        "Wine bars need occasion anchoring. A named “hour” sells the second glass and pairs with snacky skewers.",
      signalScore: 72,
      lastUpdated: isoTimestamp,
      sources: [...PLACEHOLDER_SOURCES],
      neighborhoods: ["Echo Park", "Los Feliz", "Downtown LA"],
      restaurants: [
        { name: "Bar Bandini", neighborhood: "Echo Park" },
        { name: "Tilda", neighborhood: "Echo Park" },
        { name: "Tabula Rasa", neighborhood: "Koreatown" },
      ],
      menuItems: [
        "Smoky fino highball",
        "Olive-washed “martini”",
        "Sherry + tonic round",
      ],
      confidence: "medium",
    },
  ];
}

function simulatedAboutToHitTrends(isoTimestamp: string): Trend[] {
  return [
    {
      id: "olive-oil-dessert-loops",
      name: "Olive Oil Dessert Loops",
      description:
        "Whipped mascarpone, citrus, and grassy olive oil looping onto cakes and soft-serve on dessert-only cards.",
      whyItsEverywhere:
        "Guests still want ‘clean’ finales. Olive oil reads luxury without chocolate heaviness—easy to test as a special.",
      signalScore: 58,
      lastUpdated: isoTimestamp,
      sources: [...PLACEHOLDER_SOURCES],
      neighborhoods: ["Larchmont", "Santa Monica", "Echo Park"],
      restaurants: [
        { name: "Botanica Restaurant", neighborhood: "Silver Lake" },
        { name: "Sweet Rose Creamery", neighborhood: "Brentwood" },
        { name: "République Café", neighborhood: "Mid-Wilshire" },
      ],
      menuItems: [
        "Olive oil soft serve swirl",
        "Semolina cake + bergamot",
        "Whipped ricotta olive oil dip dessert",
      ],
      confidence: "low",
    },
    {
      id: "filipino-bbq-skewer-nights",
      name: "Filipino BBQ Skewer Nights",
      description:
        "Sweet-savory pork and chicken skewer platters with calamansi, garlic rice, and banana ketchup nods on patio menus.",
      whyItsEverywhere:
        "Family-style skewer trays travel well to outdoor dining. Breweries are looking for bold, shareable proteins.",
      signalScore: 55,
      lastUpdated: isoTimestamp,
      sources: [...PLACEHOLDER_SOURCES],
      neighborhoods: ["Historic Filipinotown", "Artesia", "North Hollywood"],
      restaurants: [
        { name: "LASA Supper Club", neighborhood: "Chinatown" },
        { name: "Bangkok BBQ", neighborhood: "North Hollywood" },
        { name: "Weekend brewery pop-ups", neighborhood: "Arts District" },
      ],
      menuItems: [
        "Calamansi-glazed pork stick",
        "Chicken inasal skewer bundle",
        "Garlic rice family tray",
      ],
      confidence: "low",
    },
    {
      id: "ube-basque-slices",
      name: "Ube Basque Cheesecake Slices",
      description:
        "Burnt tops, purple yam custard centers, and Filipino-dessert crossovers landing on pastry cases from Sawtelle to Long Beach.",
      whyItsEverywhere:
        "Ube still moves on social. Basque format is forgiving for small kitchens testing weekend drops.",
      signalScore: 52,
      lastUpdated: isoTimestamp,
      sources: [...PLACEHOLDER_SOURCES],
      neighborhoods: ["Sawtelle", "Long Beach", "West Adams"],
      restaurants: [
        { name: "Cafe 86", neighborhood: "Artesia" },
        { name: "Broadway Corridor bakeries", neighborhood: "Long Beach" },
        { name: "Smorgasburg pastry stalls", neighborhood: "Downtown LA" },
      ],
      menuItems: ["Ube basque wedge", "Macapuno coconut cream side", "Pandan swirl cheesecake"],
      confidence: "low",
    },
  ];
}

async function main(): Promise<void> {
  const lastUpdated = new Date().toISOString();
  const primary = simulatedPrimaryTrends(lastUpdated);
  const aboutToHit = simulatedAboutToHitTrends(lastUpdated);
  const data: LaFoodTrendsDataFile = {
    lastUpdated,
    trends: primary,
    aboutToHit,
  };
  await fs.writeFile(LA_FOOD_TRENDS_DATA_FILE, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
  console.log(
    `Wrote ${data.trends.length} primary, ${data.aboutToHit.length} about-to-hit → ${LA_FOOD_TRENDS_DATA_FILE}`,
  );
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
