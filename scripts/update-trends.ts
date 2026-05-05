/**
 * MVP ingestion entry: simulates pulling real-world signals (no APIs yet),
 * writes `data/la-food-trends.json` in the canonical `LaFoodTrendsDataFile` shape.
 */

import fs from "node:fs/promises";
import { laFoodTrendsFileToDiskJson } from "@/lib/normalizeTrend";
import { buildSimulatedTrendsFile } from "@/lib/updateTrendsSimulation";
import { LA_FOOD_TRENDS_DATA_FILE } from "@/lib/laFoodTrendsData";

async function main(): Promise<void> {
  const lastUpdated = new Date().toISOString();
  const data = buildSimulatedTrendsFile(lastUpdated);
  const forDisk = laFoodTrendsFileToDiskJson(data);
  await fs.writeFile(LA_FOOD_TRENDS_DATA_FILE, `${JSON.stringify(forDisk, null, 2)}\n`, "utf-8");
  console.log(
    `Wrote ${data.trends.length} primary, ${data.aboutToHit.length} about-to-hit → ${LA_FOOD_TRENDS_DATA_FILE}`,
  );
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
