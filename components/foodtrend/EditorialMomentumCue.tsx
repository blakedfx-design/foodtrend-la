import type { MomentumCue } from "@/lib/editorialMomentumCue";

/** Restrained editorial note—no platforms, no outbound links, no sourcing language. */
export function EditorialMomentumCue({ cue }: { cue: MomentumCue }) {
  return (
    <aside className="ft-momentum-cue" aria-label={`${cue.kicker}: ${cue.dek}`}>
      <span className="ft-momentum-cue__kicker">{cue.kicker}</span>
      <p className="ft-momentum-cue__dek">{cue.dek}</p>
    </aside>
  );
}
