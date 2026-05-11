import { loadLocalDevEnv } from "./loadLocalDevEnv";
import { getPipelineHealthPayload } from "@/lib/debug/getPipelineHealth";
import { envPresenceFlags } from "@/lib/pipelineAudit";

loadLocalDevEnv();

async function main(): Promise<void> {
  const flags = envPresenceFlags();
  const payload = await getPipelineHealthPayload();
  const gp = payload.sources.google_places_reviews;
  const meta = payload.sources.google_places_metadata;
  // Do not log raw env values or API keys.
  console.log(
    JSON.stringify(
      {
        hasGooglePlacesKey: flags.hasGooglePlacesKey,
        google_places_reviews: {
          enabled: gp.enabled,
          lifecycle: gp.lifecycle,
          statusDetail: gp.statusDetail,
          signalCount: gp.signalCount,
          debugNotes: gp.debugNotes?.slice(0, 8) ?? [],
        },
        google_places_metadata: {
          enabled: meta.enabled,
          lifecycle: meta.lifecycle,
          statusDetail: meta.statusDetail,
          signalCount: meta.signalCount,
        },
      },
      null,
      2,
    ),
  );
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
