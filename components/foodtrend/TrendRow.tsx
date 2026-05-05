import type { ReactNode } from "react";
import type { WherePick } from "./wherePick";
import { WherePickList } from "./WherePickList";

export type FtTrendRowProps = {
  rankKicker: string;
  rankNum: string;
  icon: ReactNode;
  title: string;
  description: string;
  why: string[];
  whereItems: WherePick[];
  mostSpottedRest: string;
  worthSplurgeRest: string;
  easyEntryRest: string;
  signal: number;
  stage: string;
  bars: { menu: number; search: number; social: number };
  whyItWorks?: string;
};

function FtBlockBar({ filled }: { filled: number }) {
  const n = Math.min(10, Math.max(0, Math.round(filled)));
  return (
    <div className="ft-block-bar" aria-hidden>
      {Array.from({ length: 10 }, (_, i) => (i < n ? <i key={i} /> : <em key={i} />))}
    </div>
  );
}

/** Report trend: title band + WHERE (primary) + WHY (supporting). */
export default function TrendRow({
  rankKicker,
  rankNum,
  icon,
  title,
  description,
  why,
  whereItems,
  mostSpottedRest,
  worthSplurgeRest,
  easyEntryRest,
  signal,
  stage,
  bars,
  whyItWorks,
}: FtTrendRowProps) {
  const titleId = `ft-trend-${rankNum}`;

  return (
    <article className="ft-trend-row" aria-labelledby={titleId}>
      <div className="ft-trend-top">
        <div className="ft-rank-cell">
          <div className="ft-row-kicker">{rankKicker}</div>
          <div className="ft-rank-number">{rankNum}</div>
          {icon}
        </div>

        <div className="ft-story-cell ft-story-cell--lead">
          <h3 id={titleId}>{title}</h3>
          <p>{description}</p>
        </div>

        <div className="ft-signal-cell">
          <div className="ft-signal-head">
            <strong>SIGNAL {signal}</strong>
            <span>{stage}</span>
          </div>

          <div className="ft-bar-row">
            <span>Menu Spread</span>
            <FtBlockBar filled={bars.menu} />
          </div>
          <div className="ft-bar-row">
            <span>Search Lift</span>
            <FtBlockBar filled={bars.search} />
          </div>
          <div className="ft-bar-row">
            <span>Social Mentions</span>
            <FtBlockBar filled={bars.social} />
          </div>
        </div>
      </div>

      <div className="ft-trend-body">
        <div className="ft-where-row">
          <div className="ft-trend-spacer" aria-hidden />
          <div className="ft-where-row-content">
            <h4 className="ft-trend-label ft-trend-label--where">WHERE TO GET IT</h4>
            <div className="ft-most-spotted">
              Most spotted: {mostSpottedRest}
            </div>
            <div className="ft-callouts">
              <div className="ft-splurge">
                Worth the splurge: {worthSplurgeRest}
              </div>
              <div className="ft-entry">
                Easy entry: {easyEntryRest}
              </div>
            </div>
            <WherePickList picks={whereItems} />
          </div>
        </div>

        <div className="ft-why-row">
          <div className="ft-trend-spacer" aria-hidden />
          <div className="ft-why-row-content">
            <h4 className="ft-trend-label ft-trend-label--why">WHY IT&apos;S EVERYWHERE</h4>
            <ul className="ft-why-list">
              {why.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
            {whyItWorks ? <p className="ft-why-works">{whyItWorks}</p> : null}
          </div>
        </div>
      </div>
    </article>
  );
}
