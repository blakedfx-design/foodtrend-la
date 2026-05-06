import type { ReactNode } from "react";
import type { WherePick } from "./wherePick";
import { EditorialVenueLine } from "./EditorialVenueLine";

export type FtTrendRowProps = {
  trendId: string;
  rankKicker: string;
  rankNum: string;
  icon: ReactNode;
  title: string;
  description: string;
  picks: WherePick[];
  why: string[];
  cuisineOrigin?: string;
  mealType?: string;
  mealMoment?: string;
  mealScanLabel?: string;
  momentumScore: number;
  popularityScore: number;
  moveCopy: string;
};

const SEGMENTS = 20;

function SegmentBar({ value, tone }: { value: number; tone: "rust" | "gold" }) {
  const filled = Math.round((Math.min(100, Math.max(0, value)) / 100) * SEGMENTS);
  return (
    <div className={`ft-editorial-segbar ft-editorial-segbar--${tone}`} aria-hidden>
      {Array.from({ length: SEGMENTS }, (_, i) => (
        <span key={i} className={i < filled ? "ft-editorial-segbar__on" : "ft-editorial-segbar__off"} />
      ))}
    </div>
  );
}

function WhyGlyph({ index }: { index: number }) {
  const glyphs = [
    <svg key="g0" viewBox="0 0 24 24" width="20" height="20" aria-hidden>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 14c2-4 6-4 8 0" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M12 6v4M10 8h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>,
    <svg key="g1" viewBox="0 0 24 24" width="20" height="20" aria-hidden>
      <circle cx="9" cy="11" r="3" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="16" cy="10" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M6 18c1.5-3 5-4 8-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>,
    <svg key="g2" viewBox="0 0 24 24" width="20" height="20" aria-hidden>
      <path
        d="M12 5l2 6 6 1-4.5 4 1 6L12 18l-4.5 4 1-6L4 12l6-1 2-6z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>,
  ];
  return (
    <span className="ft-editorial-card__why-glyph" aria-hidden>
      {glyphs[index % glyphs.length]}
    </span>
  );
}

function InsightCircleIcon({ children }: { children: ReactNode }) {
  return <span className="ft-editorial-insight__circle">{children}</span>;
}

/** Premium editorial trend card (Foodtrend LA report + snapshot). */
export default function TrendRow({
  trendId,
  rankKicker,
  rankNum,
  icon,
  title,
  description,
  picks,
  why,
  cuisineOrigin,
  mealType,
  mealMoment,
  mealScanLabel,
  momentumScore,
  popularityScore,
  moveCopy,
}: FtTrendRowProps) {
  const titleId = `ft-editorial-${trendId}`;
  const spotPick = picks[0];
  const showSpot = Boolean(spotPick && spotPick.restaurant.trim() !== "—");
  const gridOffset = showSpot ? 1 : 0;
  const visible = picks.slice(gridOffset, gridOffset + 3);
  const extra = Math.max(0, picks.length - gridOffset - 3);
  const moreStart = gridOffset + 3;
  const moreTargetId = `${trendId}-more-restaurants`;
  const cuisineDisplay = cuisineOrigin?.trim() || "—";
  const mealTypeDisplay = mealType?.trim() || "General";
  const mealMomentDisplay = mealMoment?.trim();
  const move = moveCopy;
  const whyLines = why.slice(0, 3);

  return (
    <article id={`trend-${trendId}`} className="ft-editorial-card" aria-labelledby={titleId}>
      <div className="ft-editorial-card__grid">
        <div className="ft-editorial-card__rail">
          <span className="ft-editorial-card__kicker">{rankKicker}</span>
          <span className="ft-editorial-card__rank-num" aria-hidden>
            {rankNum}
          </span>
          <div className="ft-editorial-card__dish-icon">{icon}</div>
        </div>

        <div className="ft-editorial-card__main">
          <div className="ft-editorial-card__title-block">
            {mealScanLabel ? (
              <p className="ft-editorial-card__meal-cue">{mealScanLabel}</p>
            ) : null}
            <h3 id={titleId} className="ft-editorial-card__title">
              {title}
            </h3>
          </div>
          {description ? <p className="ft-editorial-card__dek">{description}</p> : null}

          {showSpot ? (
            <div className="ft-editorial-card__spot-block">
              <p className="ft-editorial-card__eyebrow ft-editorial-card__eyebrow--spot">THE SPOT</p>
              <EditorialVenueLine pick={spotPick} variant="spot" />
            </div>
          ) : null}

          {picks.length > (showSpot ? 1 : 0) ? (
            <div className="ft-editorial-card__serving-block">
              <div className="ft-editorial-card__hairline ft-editorial-card__hairline--section" aria-hidden />

              {visible.length > 0 ? (
                <>
                  <p className="ft-editorial-card__eyebrow ft-editorial-card__eyebrow--serving">ALSO SERVING</p>
                  <div className="ft-editorial-card__rest-grid">
                    {visible.map((pick, i) => (
                      <div key={`${pick.restaurant}-${gridOffset + i}`} className="ft-editorial-card__rest-cell">
                        <EditorialVenueLine pick={pick} variant="serving" />
                      </div>
                    ))}
                  </div>
                </>
              ) : null}

              {extra > 0 ? (
                <a href={`#${moreTargetId}`} className="ft-editorial-card__more-link">
                  +{extra} more spots →
                </a>
              ) : null}

              {extra > 0 ? (
                <div id={moreTargetId} className="ft-editorial-card__more-panel" tabIndex={-1}>
                  <p className="ft-editorial-card__more-head">Also serving</p>
                  <ul className="ft-editorial-card__more-list">
                    {picks.slice(moreStart).map((pick, i) => (
                      <li key={`${pick.restaurant}-more-${i}`}>
                        <EditorialVenueLine pick={pick} variant="serving" />
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="ft-editorial-card__hairline ft-editorial-card__hairline--section ft-editorial-card__hairline--before-why" aria-hidden />

          <p className="ft-editorial-card__eyebrow">WHY IT&apos;S EVERYWHERE</p>
          <ul className="ft-editorial-card__why-list">
            {whyLines.map((line, i) => (
              <li key={i} className="ft-editorial-card__why-row">
                <WhyGlyph index={i} />
                <span className="ft-editorial-card__why-text">{line}</span>
              </li>
            ))}
          </ul>
        </div>

        <aside className="ft-editorial-card__insight" aria-label="Right now">
          <div className="ft-editorial-insight__block">
            <InsightCircleIcon>
              <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden>
                <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <path
                  d="M12 3c-4 5-4 13 0 18 4-5 4-13 0-18z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.3"
                />
              </svg>
            </InsightCircleIcon>
            <div>
              <p className="ft-editorial-insight__label">CUISINE / ORIGIN</p>
              <p className="ft-editorial-insight__value">{cuisineDisplay}</p>
            </div>
          </div>

          <div className="ft-editorial-insight__block">
            <InsightCircleIcon>
              <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden>
                <path
                  d="M8 6h8v12H8z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinejoin="round"
                />
                <path d="M10 10h4M10 13h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            </InsightCircleIcon>
            <div>
              <p className="ft-editorial-insight__label">MEAL TYPE / MOMENT</p>
              <p className="ft-editorial-insight__value">{mealTypeDisplay}</p>
              {mealMomentDisplay ? (
                <p className="ft-editorial-insight__sub">{mealMomentDisplay}</p>
              ) : null}
            </div>
          </div>

          <div className="ft-editorial-insight__hairline" />

          <p className="ft-editorial-insight__stamp">RIGHT NOW</p>

          <div
            className="ft-editorial-strength"
            aria-label={`Momentum score ${momentumScore} out of 100`}
          >
            <div className="ft-editorial-strength__icon ft-editorial-strength__icon--rust">
              <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden>
                <path
                  d="M6 18 L18 6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <path d="M14 6h4v4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <div className="ft-editorial-strength__body">
              <div className="ft-editorial-strength__top">
                <span className="ft-editorial-strength__name">MOMENTUM</span>
                <span className="ft-editorial-strength__score ft-editorial-strength__score--rust">
                  {momentumScore}
                </span>
              </div>
              <SegmentBar value={momentumScore} tone="rust" />
            </div>
          </div>

          <div
            className="ft-editorial-strength"
            aria-label={`Popularity score ${popularityScore} out of 100`}
          >
            <div className="ft-editorial-strength__icon ft-editorial-strength__icon--gold">
              <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden>
                <circle cx="9" cy="11" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="16" cy="10" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </div>
            <div className="ft-editorial-strength__body">
              <div className="ft-editorial-strength__top">
                <span className="ft-editorial-strength__name">POPULARITY</span>
                <span className="ft-editorial-strength__score ft-editorial-strength__score--gold">
                  {popularityScore}
                </span>
              </div>
              <SegmentBar value={popularityScore} tone="gold" />
            </div>
          </div>

          <div className="ft-editorial-card__move">
            <p className="ft-editorial-card__move-label">THE MOVE</p>
            <p className="ft-editorial-card__move-copy">{move}</p>
          </div>
        </aside>
      </div>
    </article>
  );
}
