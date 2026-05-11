import path from "node:path";
import { config } from "dotenv";

/**
 * Match Next.js local env merging: `.env` then `.env.local` (later overrides).
 * Raw `node` / `tsx` does not load `.env.local`; call this before code that reads `process.env`
 * so CLI diagnostics agree with `next dev` / `next build`.
 */
export function loadLocalDevEnv(): void {
  config({ path: path.join(process.cwd(), ".env"), quiet: true });
  config({ path: path.join(process.cwd(), ".env.local"), override: true, quiet: true });
}
