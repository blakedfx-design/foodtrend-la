# FoodTrend LA

## Data sources (integrity)

- **Manual social proxy (TikTok / Instagram):** Counts and tags come from editorial or manually curated fields in trend data. The app does **not** scrape TikTok or Instagram.
- **Reservations rollup:** Uses **manual / internal** `reservationSignals` on trend records only. It does not call Resy, OpenTable, or Tock. The rollup stays inactive until at least one trend includes real `reservationSignals` (no fake seeded rows).
- **Google Places:** Uses the real **Google Places API** when `GOOGLE_PLACES_API_KEY` is set; health reflects actual request outcomes.
- **Reddit:** Credentials may be configured for other jobs, but **`getRedditSignals` is currently a stub**—normalized Reddit signals are not merged into the live candidate pipeline until that adapter is implemented.

## Local environment vs CLI scripts

Next.js loads `.env` and `.env.local` at dev/build time. A plain **`tsx` or `node` process does not**, so `process.env.GOOGLE_PLACES_API_KEY` (and other vars) can be **missing in scripts** even when `next dev` sees them. For pipeline health parity locally, run **`npm run pipeline-health`** (uses `scripts/loadLocalDevEnv.ts`) or call `loadLocalDevEnv()` before importing app code that reads the environment.
