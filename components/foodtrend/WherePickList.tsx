import type { WherePick } from "./wherePick";

export function WherePickList({ picks }: { picks: WherePick[] }) {
  return (
    <div className="ft-where-list" role="list">
      {picks.map((pick, i) => (
        <div key={`${pick.restaurant}-${i}`} className="ft-where-item" role="listitem">
          <div className="ft-where-restaurant">
            {pick.restaurant} <span>({pick.neighborhood})</span>
          </div>
          <div className="ft-where-dish">— {pick.dish}</div>
        </div>
      ))}
    </div>
  );
}
