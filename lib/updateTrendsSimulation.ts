import type { LaFoodTrendsDataFile } from "@/types/laFoodTrend";
import { normalizeTrendRow } from "@/lib/normalizeTrend";

export const PLACEHOLDER_SOURCES = [
  "Google Maps",
  "Restaurant Menu",
  "Reddit LA",
  "Food Blog",
] as const;

function venueFallbackMaps(name: string, hood: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name}, ${hood}, Los Angeles, CA`)}`;
}

/** Illustrative snapshot only — not verified live menu research. */
export function simulatedPrimaryTrends(isoTimestamp: string): unknown[] {
  return [
    {
      id: "korean-ssam-bar-snacks",
      name: "Korean Ssam Bar Snacks",
      description:
        "Lettuce, ssamjang, sizzling picks — the table refuses to quiet down.",
      moveCopy: "Wrap it, drag it through sauce, repeat.",
      whyItsEverywhere:
        "Built for grazing, not committing.\nEvery bite gets a little messier.\nLate-night food with actual structure.",
      signalScore: 88,
      lastUpdated: isoTimestamp,
      sources: [...PLACEHOLDER_SOURCES],
      neighborhoods: ["Koreatown", "Arts District"],
      restaurants: [
        {
          name: "Dan Sung Sa",
          neighborhood: "Koreatown",
          instagramUrl: "https://www.instagram.com/dan_sung_sa_la/",
          googleMapsUrl: venueFallbackMaps("Dan Sung Sa", "Koreatown"),
        },
        {
          name: "Jilli",
          neighborhood: "Koreatown",
          instagramUrl: "https://www.instagram.com/jilli.la/",
          googleMapsUrl: venueFallbackMaps("Jilli", "Koreatown"),
        },
        {
          name: "Yangban Society",
          neighborhood: "Arts District",
          instagramUrl: "https://www.instagram.com/yangbanla/",
          googleMapsUrl: venueFallbackMaps("Yangban Society", "Arts District"),
        },
      ],
      menuItems: [
        "Pork belly ssam with perilla leaf, rice, and ssamjang — build it yourself, eat it in one bite",
      ],
      confidence: "high",
    },
    {
      id: "sonoran-breakfast-burritos",
      name: "Sonoran-Style Breakfast Burritos",
      description:
        "Blistered flour tortilla, egg, potato, machaca — morning belt-buckle fuel.",
      moveCopy: "Respect the tortilla.",
      whyItsEverywhere:
        "The flour tortilla is doing real work.\nBreakfast, but with road-trip energy.\nSalsa decides the whole thing.",
      signalScore: 81,
      lastUpdated: isoTimestamp,
      sources: [...PLACEHOLDER_SOURCES],
      neighborhoods: ["Downtown LA", "Whittier", "Glassell Park"],
      restaurants: [
        {
          name: "Sonoratown",
          neighborhood: "Downtown LA",
          instagramUrl: "https://www.instagram.com/sonoratownla/",
          googleMapsUrl: venueFallbackMaps("Sonoratown", "Downtown LA"),
        },
        {
          name: "Colonia Publica",
          neighborhood: "Whittier",
          instagramUrl: "https://www.instagram.com/coloniapublica/",
          googleMapsUrl: venueFallbackMaps("Colonia Publica", "Whittier"),
        },
        {
          name: "Cilantro Mexican Grill",
          neighborhood: "Glassell Park",
          instagramUrl: "https://www.instagram.com/cilantromex/",
          googleMapsUrl: venueFallbackMaps("Cilantro Mexican Grill", "Glassell Park"),
        },
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
        "Poached bird, schmaltz-y rice, sauce trio — counter-speed SGV lunch.",
      moveCopy: "Get the rice. Don't negotiate.",
      whyItsEverywhere:
        "The chicken is quiet; the rice does the talking.\nIt feels clean, but still fully lunch.\nSauces turn one plate into three moods.",
      signalScore: 79,
      lastUpdated: isoTimestamp,
      sources: [...PLACEHOLDER_SOURCES],
      neighborhoods: ["Alhambra", "Pasadena", "Chinatown", "Monterey Park"],
      restaurants: [
        {
          name: "Savoy Kitchen",
          neighborhood: "Alhambra",
          instagramUrl: "https://www.instagram.com/savoykitchen/",
          googleMapsUrl: venueFallbackMaps("Savoy Kitchen", "Alhambra"),
        },
        {
          name: "Cluck2Go",
          neighborhood: "Pasadena",
          instagramUrl: "https://www.instagram.com/cluck2go/",
          googleMapsUrl: venueFallbackMaps("Cluck2Go", "Pasadena"),
        },
        {
          name: "Pearl River Deli",
          neighborhood: "Chinatown",
          instagramUrl: "https://www.instagram.com/prd_la/",
          googleMapsUrl: venueFallbackMaps("Pearl River Deli", "Chinatown"),
        },
      ],
      menuItems: [
        "Hainan chicken rice — poached bird, chicken-fat rice, ginger-scallion oil",
        "Three-sauce tray — chile, ginger-scallion, sweet dark soy",
        "Extra chicken rice side — lunch-counter refill culture",
      ],
      confidence: "medium",
    },
    {
      id: "aguachile-ice",
      name: "Aguachile on Ice",
      description:
        "Shrimp in an electric lime-chile bath — colder than your beer, louder than small talk.",
      moveCopy: "Order it cold, eat it first.",
      whyItsEverywhere:
        "It hits before the table even settles.\nCitrus, chile, ice — LA's holy trinity.\nLight enough to keep the night moving.",
      signalScore: 76,
      lastUpdated: isoTimestamp,
      sources: [...PLACEHOLDER_SOURCES],
      neighborhoods: ["Venice", "Long Beach", "Boyle Heights", "West Hollywood"],
      restaurants: [
        {
          name: "Holbox",
          neighborhood: "Downtown LA",
          instagramUrl: "https://www.instagram.com/holboxlosangeles/",
          googleMapsUrl: venueFallbackMaps("Holbox", "Downtown LA"),
        },
        {
          name: "Coni'Seafood",
          neighborhood: "Inglewood",
          instagramUrl: "https://www.instagram.com/coniseafood/",
          googleMapsUrl: venueFallbackMaps("Coni'Seafood", "Inglewood"),
        },
        {
          name: "Mariscos Jalisco",
          neighborhood: "Boyle Heights",
          instagramUrl: "https://www.instagram.com/mariscosjalisco/",
          googleMapsUrl: venueFallbackMaps("Mariscos Jalisco", "Boyle Heights"),
        },
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
        "Orange wine in a stem, martini brain, golden hour spilling onto the sidewalk.",
      moveCopy: "Tiny glass, big little mood.",
      whyItsEverywhere:
        "It scratches the cocktail itch without going full cocktail.\nSalty, cold, bitter — very pre-dinner.\nMakes 6 p.m. feel like a plan.",
      signalScore: 72,
      lastUpdated: isoTimestamp,
      sources: [...PLACEHOLDER_SOURCES],
      neighborhoods: ["Echo Park", "Silver Lake"],
      restaurants: [
        {
          name: "Bar Bandini",
          neighborhood: "Echo Park",
          instagramUrl: "https://www.instagram.com/barbandini/",
          googleMapsUrl: venueFallbackMaps("Bar Bandini", "Echo Park"),
        },
        {
          name: "Tabula Rasa",
          neighborhood: "Silver Lake",
          instagramUrl: "https://www.instagram.com/tabularasabar/",
          googleMapsUrl: venueFallbackMaps("Tabula Rasa", "Silver Lake"),
        },
        {
          name: "Donna's",
          neighborhood: "Echo Park",
          instagramUrl: "https://www.instagram.com/donnas_ep/",
          googleMapsUrl: venueFallbackMaps("Donna's", "Echo Park"),
        },
      ],
      menuItems: [
        "Skin-contact white or chilled red — served cold, slightly cloudy, poured fast and refilled often",
        "Skin-contact white or chilled red — served cold, slightly cloudy, poured fast and refilled often",
        "Martini or spritz round — aperitivo pacing with funky wine still in rotation",
      ],
      confidence: "medium",
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
        {
          name: "Botanica Restaurant",
          neighborhood: "Silver Lake",
          instagramUrl: "https://www.instagram.com/botanicafood/",
          googleMapsUrl: venueFallbackMaps("Botanica Restaurant", "Silver Lake"),
        },
        {
          name: "Sweet Rose Creamery",
          neighborhood: "Brentwood",
          instagramUrl: "https://www.instagram.com/sweetrosecreamery/",
          googleMapsUrl: venueFallbackMaps("Sweet Rose Creamery", "Brentwood"),
        },
        {
          name: "République Café",
          neighborhood: "Mid-Wilshire",
          instagramUrl: "https://www.instagram.com/republique.restaurantla/",
          googleMapsUrl: venueFallbackMaps("République Café", "Mid-Wilshire"),
        },
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
      neighborhoods: ["Chinatown", "Historic Filipinotown", "Artesia", "North Hollywood"],
      restaurants: [
        {
          name: "LASA Supper Club",
          neighborhood: "Chinatown",
          instagramUrl: "https://www.instagram.com/lasasupperclub/",
          googleMapsUrl: venueFallbackMaps("LASA Supper Club", "Chinatown"),
        },
        {
          name: "Bangkok BBQ",
          neighborhood: "North Hollywood",
          instagramUrl: "https://www.instagram.com/bangkokbbqbowl/",
          googleMapsUrl: venueFallbackMaps("Bangkok BBQ", "North Hollywood"),
        },
        {
          name: "Highland Park Brewery",
          neighborhood: "Chinatown",
          instagramUrl: "https://www.instagram.com/highlandparkbrewery/",
          googleMapsUrl: venueFallbackMaps("Highland Park Brewery", "Chinatown"),
        },
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
        {
          name: "Cafe 86",
          neighborhood: "Artesia",
          instagramUrl: "https://www.instagram.com/cafe_86/",
          googleMapsUrl: venueFallbackMaps("Cafe 86", "Artesia"),
        },
        {
          name: "Broadway Corridor bakeries",
          neighborhood: "Long Beach",
          instagramUrl: "https://www.instagram.com/gustobread/",
          googleMapsUrl: venueFallbackMaps("Gusto Bread", "Long Beach"),
        },
        {
          name: "Smorgasburg pastry stalls",
          neighborhood: "Downtown LA",
          instagramUrl: "https://www.instagram.com/smorgasburgla/",
          googleMapsUrl: venueFallbackMaps("Smorgasburg LA", "Downtown LA"),
        },
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
