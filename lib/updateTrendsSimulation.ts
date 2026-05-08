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
      heroImageUrl: "/editorial/food/jilli-ssam-shared-plates.png",
      heroImageSource: "Jilli",
      heroImageCredit: "Photo provided by user",
      moveCopy: "Wrap it, drag it through sauce, repeat.",
      whyItsEverywhere:
        "Built for grazing and group ordering.\nEvery bite feels customizable.\nLettuce wraps make rich food feel lighter.\nBig flavor without full KBBQ commitment.",
      signalScore: 88,
      lastUpdated: isoTimestamp,
      sources: [...PLACEHOLDER_SOURCES],
      neighborhoods: ["Koreatown", "Arts District"],
      restaurants: [
        {
          name: "Jilli",
          neighborhood: "Koreatown",
          instagramUrl: "https://www.instagram.com/jilli.la/",
          googleMapsUrl: venueFallbackMaps("Jilli", "Koreatown"),
        },
        {
          name: "Soban",
          neighborhood: "Koreatown",
          instagramUrl: "https://www.instagram.com/sobanrestaurant/",
          googleMapsUrl: venueFallbackMaps("Soban", "Koreatown"),
        },
        {
          name: "Mapo Dak Galbi",
          neighborhood: "Koreatown",
          instagramUrl:
            "https://www.instagram.com/explore/locations/1023710200/mapo-dak-galbi---chicken-bbq/",
          googleMapsUrl: venueFallbackMaps("Mapo Dak Galbi", "Koreatown"),
        },
        {
          name: "Yangmani",
          neighborhood: "Koreatown",
          instagramUrl: "https://www.instagram.com/yangmani_la/",
          googleMapsUrl: venueFallbackMaps("Yangmani", "Koreatown"),
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
        "Thin flour tortillas, machaca, eggs, potatoes, and griddled edges.",
      heroImageUrl: "/editorial/food/macheen-sonoran-breakfast-burrito.png",
      heroImageSource: "Macheen",
      heroImageCredit: "Photo provided by user",
      moveCopy: "Find the tortilla first.",
      whyItsEverywhere:
        "Handmade flour tortillas are becoming the star.\nMachaca adds deeper savory texture than bacon.\nRegional Mexican breakfast styles are replacing generic burritos.\nCrisp griddled edges create texture without heaviness.",
      signalScore: 81,
      lastUpdated: isoTimestamp,
      sources: [...PLACEHOLDER_SOURCES],
      neighborhoods: ["Boyle Heights", "Atwater Village", "Glassell Park", "El Monte"],
      restaurants: [
        {
          name: "Macheen",
          neighborhood: "Boyle Heights",
          instagramUrl: "https://www.instagram.com/_macheen_/",
          googleMapsUrl: venueFallbackMaps("Macheen", "Boyle Heights"),
        },
        {
          name: "Tacos Villa Corona",
          neighborhood: "Atwater Village",
          instagramUrl: "https://www.instagram.com/tvcatwater/",
          googleMapsUrl: venueFallbackMaps("Tacos Villa Corona", "Atwater Village"),
        },
        {
          name: "Cilantro Mexican Grill",
          neighborhood: "Glassell Park",
          googleMapsUrl: venueFallbackMaps("Cilantro Mexican Grill", "Glassell Park"),
        },
        {
          name: "Burritos La Palma",
          neighborhood: "El Monte",
          instagramUrl: "https://www.instagram.com/burritoslapalma/",
          googleMapsUrl: venueFallbackMaps("Burritos La Palma", "El Monte"),
        },
      ],
      menuItems: [
        "Machaca breakfast burrito on a thin flour tortilla",
        "Potato-and-egg burrito with crisped griddled edges",
        "Northern Mexico-style handmade flour tortilla breakfast wrap",
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
      name: "Filipino BBQ Nights",
      description:
        "Calamansi, smoke, vinegar, and charcoal-grilled skewers.",
      heroImageUrl: "/editorial/food/dollar-hits-skewers-hero.jpg",
      heroImageSource: "Dollar Hits",
      heroImageSourceUrl: "https://www.yelp.com/biz/dollar-hits-los-angeles-2",
      heroImageCredit: "Photo via Yelp (Dollar Hits)",
      moveCopy: "Point at the skewers and keep going.",
      whyItsEverywhere:
        "Skewer culture turns dinner into an activity.\nSmoke and vinegar keep rich flavors balanced.\nFilipino BBQ is becoming LA's next great late-night food scene.\nCharcoal grilling creates instant visual craving.",
      signalScore: 55,
      lastUpdated: isoTimestamp,
      sources: [...PLACEHOLDER_SOURCES],
      neighborhoods: ["West Covina", "Chinatown", "Echo Park", "Walnut"],
      restaurants: [
        {
          name: "Dollar Hits",
          neighborhood: "West Covina",
          instagramUrl: "https://www.instagram.com/dollarhits/",
          googleMapsUrl: venueFallbackMaps("Dollar Hits", "West Covina"),
        },
        {
          name: "Lasita",
          neighborhood: "Chinatown",
          instagramUrl: "https://www.instagram.com/lasita.la/",
          googleMapsUrl: venueFallbackMaps("Lasita", "Chinatown"),
        },
        {
          name: "Park's Finest",
          neighborhood: "Echo Park",
          instagramUrl: "https://www.instagram.com/theparksfinest/",
          googleMapsUrl: venueFallbackMaps("Park's Finest", "Echo Park"),
        },
        {
          name: "Neri's Restaurant",
          neighborhood: "Walnut",
          instagramUrl: "https://www.instagram.com/nerisrestaurant/",
          googleMapsUrl: venueFallbackMaps("Neri's Restaurant", "Walnut"),
        },
      ],
      menuItems: [
        "Charcoal-grilled Filipino pork skewers with banana ketchup and vinegar dips",
        "Calamansi-forward BBQ sticks served with sawsawan and garlic rice",
        "Late-night mixed skewer set with smoke-heavy grill flavor",
      ],
      confidence: "low",
    },
    {
      id: "ube-cheesecake",
      name: "Ube Cheesecake",
      description:
        "Creamy purple yam cheesecake slices showing up across Filipino bakeries and modern dessert spots.",
      moveCopy:
        "Burnt-edge Basque riffs, classic bakery slices, and ube-forward desserts are everywhere right now.",
      whyItsEverywhere:
        "Handmade ube desserts moved from neighborhood staple to citywide craving.\nCreamy, dense slices feel nostalgic and modern at the same time.\nBakery cases are leaning hard into vivid purple texture shots.\nFilipino pastry flavors are now part of LA's mainstream dessert conversation.",
      signalScore: 78,
      lastUpdated: isoTimestamp,
      sources: [...PLACEHOLDER_SOURCES],
      neighborhoods: ["Artesia", "Sawtelle", "Carson"],
      restaurants: [
        {
          name: "Cafe 86",
          neighborhood: "Artesia",
          instagramUrl: "https://www.instagram.com/cafe_86/",
          googleMapsUrl: venueFallbackMaps("Cafe 86", "Artesia"),
        },
        {
          name: "B Sweet Dessert Bar",
          neighborhood: "Sawtelle",
          instagramUrl: "https://www.instagram.com/mybsweet/",
          googleMapsUrl: venueFallbackMaps("B Sweet Dessert Bar", "Sawtelle"),
        },
        {
          name: "Gemmae Bake Shop",
          neighborhood: "Carson",
          instagramUrl: "https://www.instagram.com/gemmaebakeshop/",
          googleMapsUrl: venueFallbackMaps("Gemmae Bake Shop", "Carson"),
        },
      ],
      menuItems: [
        "Ube cheesecake slice with creamy center and graham-style crust",
        "Burnt-edge basque-style ube cheesecake",
        "Classic bakery ube cheesecake wedge",
      ],
      confidence: "low",
      whyItWorks:
        "Burnt-edge Basque riffs, classic bakery slices, and ube-forward desserts are everywhere right now.",
      cuisineOrigin: "Modern Filipino dessert culture / bakery trend",
      mealType: "Dessert",
      mealMoment: "Afternoon / Evening",
      heroImageUrl: "/editorial/food/ube-cheesecake-cafe86.png",
      heroImageSource: "Cafe 86",
      heroImageCredit: "Photo provided by user",
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
