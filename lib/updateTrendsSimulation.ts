import type { LaFoodTrendsDataFile } from "@/types/laFoodTrend";
import { normalizeTrendRow } from "@/lib/normalizeTrend";

export const PLACEHOLDER_SOURCES = [
  "Google Maps",
  "Restaurant Menu",
  "Reddit LA",
  "Food Blog",
] as const;

/** Illustrative snapshot only — not verified live menu research. */
export function simulatedPrimaryTrends(isoTimestamp: string): unknown[] {
  return [
    {
      id: "korean-ssam-bar-snacks",
      name: "Korean Ssam Bar Snacks",
      description:
        "Grilled meats, banchan, and build-your-own lettuce wraps taking over late dinners.",
      whyItsEverywhere:
        "Dinner turns into something interactive. Tables are ordering everything, passing plates, and building wraps nonstop — it's louder, more social, and people stay way longer.",
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
        "Pork belly ssam with perilla leaf, rice, and ssamjang — build it yourself, eat it in one bite",
      ],
      confidence: "high",
      whyItWorks:
        "Hands-on, fast, and built for sharing — the table never slows down.",
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
        "Chilled, citrusy aguachile served ice-cold — bright, spicy, and built for warm LA nights.",
      whyItsEverywhere:
        "It's the perfect LA table-starter: cold, sharp, and loud with lime. People are ordering it before the meal even starts, passing chips around, and scraping the last bits of cucumber and chile from the plate.",
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
        "Shrimp aguachile verde — heavy lime, serrano heat, sliced cucumber, served ice-cold with tostadas.",
      ],
      confidence: "medium",
      whyItWorks:
        "Cold seafood, high acid, and chile heat — it wakes up the whole table.",
    },
    {
      id: "natural-wine-martini-hour",
      name: "Natural Wine “Martini” Hour",
      description:
        "Chilled natural wines poured like martinis — early evening, low-key buzz, everywhere right now.",
      whyItsEverywhere:
        "It’s replacing the traditional happy hour. People aren’t doing rounds of cocktails — they’re posting up with a cold glass of something funky and staying for hours. You see it spilling onto sidewalks in Silver Lake and Echo Park right around golden hour.",
      signalScore: 72,
      lastUpdated: isoTimestamp,
      sources: [...PLACEHOLDER_SOURCES],
      neighborhoods: ["Echo Park", "Silver Lake", "Virgil Village"],
      restaurants: [
        { name: "Bar Bandini", neighborhood: "Echo Park" },
        { name: "Tabula Rasa", neighborhood: "Silver Lake" },
        { name: "Melody", neighborhood: "Virgil Village" },
      ],
      menuItems: [
        "Skin-contact white or chilled red — served cold, slightly cloudy, poured fast and refilled often",
        "Skin-contact white or chilled red — served cold, slightly cloudy, poured fast and refilled often",
        "Skin-contact white or chilled red — served cold, slightly cloudy, poured fast and refilled often",
      ],
      confidence: "medium",
      whyItWorks:
        "Why it works — lower alcohol, high flavor — you can drink it like a cocktail but stay longer. It turns one drink into the whole night.",
    },
  ];
}

export function simulatedAboutToHitTrends(isoTimestamp: string): unknown[] {
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

/**
 * Same pipeline as `scripts/update-trends.ts` (without writing to disk).
 * Used by the weekly cron to simulate a full refresh in memory.
 */
export function buildSimulatedTrendsFile(isoTimestamp: string): LaFoodTrendsDataFile {
  const trends = simulatedPrimaryTrends(isoTimestamp).map((row) => normalizeTrendRow(row));
  const aboutToHit = simulatedAboutToHitTrends(isoTimestamp).map((row) =>
    normalizeTrendRow(row),
  );
  return {
    lastUpdated: isoTimestamp,
    trends,
    aboutToHit,
  };
}
