import Link from "next/link";
import { SourceDatabaseIcon } from "@/components/foodtrend/FoodTrendIcons";
import { TrendIconForName } from "@/components/foodtrend/TrendIconForName";
import { pctToBarTen, SignalBars } from "@/components/foodtrend/SignalBars";
import { WherePickList } from "@/components/foodtrend/WherePickList";
import {
  getMostSpottedRestLine,
  getSplurgeRestLine,
  getEntryRestLine,
} from "@/lib/whereShowing";
import {
  barsFromSignalScore,
  getDataFreshnessSummary,
  getDisplayAboutToHit,
  getDisplayPrimaryTrends,
  mapTrendToWherePicks,
  readLaFoodTrendsDataFile,
  stageArrowFromConfidence,
} from "@/lib/laFoodTrendsData";
import { splitWhy } from "@/lib/trendText";
import type { LaFoodTrendsDataFile } from "@/types/laFoodTrend";

export const dynamic = "force-dynamic";

const HOME_DISPATCH_CSS = `
.ft-home-dispatch {
  --ft-line: #d9d5c9;
  --ft-rust: #b8523f;
  --ft-ink: #0b1d35;
  --ft-muted: #697386;
}

.ft-home-dispatch .ft-hero {
  position: relative;
  min-height: 340px;
  border-bottom: 1px solid var(--ft-line);
  margin-bottom: 36px;
  overflow: hidden;
  display: flex;
  align-items: flex-start;
  padding-top: 2rem;
  background: #f6f3ec;
}

.ft-home-dispatch .ft-hero-copy {
  position: relative;
  z-index: 2;
  max-width: 520px;
  padding-right: 2rem;
}

.ft-home-dispatch .ft-hero h1 {
  margin: 0 0 0.65rem;
  font-family: Georgia, "Times New Roman", serif;
  font-size: clamp(72px, 9vw, 104px);
  line-height: 0.92;
  letter-spacing: -0.04em;
  font-weight: 600;
  color: var(--ft-ink);
}

.ft-home-dispatch .ft-hero-subtitle {
  margin: 0 0 1.25rem;
  max-width: 28rem;
  font-size: 22px;
  line-height: 1.4;
  color: var(--ft-muted);
  font-weight: 400;
}

.ft-home-dispatch .ft-hero-art {
  position: absolute;
  right: -10%;
  bottom: -10px;
  width: 85%;
  max-width: none;
  opacity: 0.38;
  pointer-events: none;
  background: none;
  border: none;
  box-shadow: none;
}

.ft-home-dispatch .ft-hero-art::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 1;
  background: linear-gradient(
    to left,
    rgba(246, 243, 236, 0) 60%,
    rgba(246, 243, 236, 1) 100%
  );
}

.ft-home-dispatch .ft-hero-art img {
  width: 100%;
  height: auto;
  display: block;
  background: transparent;
  mix-blend-mode: multiply;
  filter: saturate(0.9) contrast(0.95) blur(0.2px);
}

.ft-home-dispatch .ft-layout {
  display: grid;
  grid-template-columns: minmax(0, 860px) 330px;
  gap: 36px;
  align-items: start;
}

.ft-home-dispatch .ft-section-title {
  margin: 0 0 1rem;
}

.ft-home-dispatch .ft-section-support {
  margin: -0.35rem 0 1.35rem;
}

.ft-home-dispatch .ft-trend-row {
  display: flex;
  flex-direction: column;
  padding: 28px 0;
  border-bottom: 1px solid var(--ft-line);
  align-items: stretch;
  text-align: left;
}

.ft-home-dispatch .ft-trend-top {
  display: grid;
  grid-template-columns: 150px 1fr 260px;
  gap: 24px;
  align-items: start;
}

.ft-home-dispatch .ft-trend-body {
  min-width: 0;
}

.ft-home-dispatch .ft-where-row,
.ft-home-dispatch .ft-why-row {
  display: grid;
  grid-template-columns: 150px minmax(0, 1fr);
  gap: 24px;
  align-items: start;
}

.ft-home-dispatch .ft-where-row {
  margin-top: 18px;
}

.ft-home-dispatch .ft-why-row {
  margin-top: 14px;
}

.ft-home-dispatch .ft-why-row-content {
  max-width: 520px;
  font-size: 14px;
  line-height: 1.45;
  opacity: 0.85;
}

.ft-home-dispatch .ft-trend-label {
  margin: 0 0 0.4rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--ft-muted);
}

.ft-home-dispatch .ft-trend-label--where {
  font-size: 0.6875rem;
}

.ft-home-dispatch .ft-trend-label--why {
  font-size: 0.5625rem;
  opacity: 0.88;
}

.ft-home-dispatch .ft-most-spotted {
  font-weight: 600;
  font-size: 15px;
  line-height: 1.35;
  margin-bottom: 10px;
  color: var(--ft-ink);
}

.ft-home-dispatch .ft-callouts {
  margin-bottom: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ft-home-dispatch .ft-splurge,
.ft-home-dispatch .ft-entry {
  font-size: 14px;
  opacity: 0.85;
}

.ft-home-dispatch .ft-home-report-rows > .ft-trend-row:last-child {
  border-bottom: none;
}

.ft-home-dispatch .ft-rank-cell {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
}

.ft-home-dispatch .ft-row-kicker {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  color: var(--ft-muted);
  opacity: 0.6;
}

.ft-home-dispatch .ft-rank-number {
  font-size: 56px;
  line-height: 1;
  color: var(--ft-rust);
  font-family: Georgia, serif;
  font-weight: 600;
}

.ft-home-dispatch .ft-rank-cell .food-icon {
  width: 40px;
  height: 40px;
}

.ft-home-dispatch .ft-story-cell {
  min-width: 0;
}

.ft-home-dispatch .ft-story-cell h3 {
  margin: 0 0 0.35rem;
  font-family: Georgia, "Times New Roman", serif;
  font-size: clamp(1.2rem, 2vw, 1.45rem);
  font-weight: 600;
  color: var(--ft-ink);
}

.ft-home-dispatch .ft-story-cell--lead > .ft-story-lede {
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.48;
  color: var(--ft-muted);
}

.ft-home-dispatch .ft-where-row .ft-where-list {
  gap: 16px 32px;
  font-size: 15px;
}

.ft-home-dispatch .ft-where-row .ft-where-restaurant {
  font-size: 15px;
}

.ft-home-dispatch .ft-where-row .ft-where-dish {
  font-size: 14px;
}

.ft-home-dispatch .ft-why-list {
  margin: 0;
  padding-left: 1rem;
}

.ft-home-dispatch .ft-why-row .ft-why-list li {
  font-size: 14px;
  line-height: 1.45;
  margin-bottom: 0.3rem;
  color: color-mix(in srgb, var(--ft-ink) 76%, var(--ft-muted));
}

.ft-home-dispatch .ft-why-row .ft-why-list li:last-child {
  margin-bottom: 0;
}

.ft-home-dispatch .ft-signal-cell {
  border-left: 1px solid var(--ft-line);
  padding-left: 28px;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.ft-home-dispatch .ft-signal-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.45rem 0.55rem;
  font-size: 14px;
  margin-bottom: 10px;
}

.ft-home-dispatch .ft-signal-head strong {
  font-weight: 700;
  color: var(--ft-ink);
}

.ft-home-dispatch .ft-signal-head span {
  font-weight: 700;
  color: var(--ft-rust);
  letter-spacing: 0.06em;
}

.ft-home-dispatch .ft-bar-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}

.ft-home-dispatch .ft-bar-row:last-child {
  margin-bottom: 0;
}

.ft-home-dispatch .ft-bar-row > span:first-child {
  flex: 0 0 auto;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: var(--ft-muted);
  opacity: 0.6;
  max-width: 6.25rem;
}

.ft-home-dispatch .ft-block-bar {
  display: grid;
  grid-template-columns: repeat(10, 1fr);
  gap: 3px;
  margin-top: 0;
  flex: 1;
  min-width: 0;
}

.ft-home-dispatch .ft-block-bar span {
  height: 12px;
  background: var(--ft-ink);
  display: block;
}

.ft-home-dispatch .ft-block-bar span.empty {
  background: #e5e1d8;
}

.ft-home-dispatch .ft-sidebar-panel-host .ft-sidebar {
  position: sticky;
  top: 1.5rem;
}

.ft-home-dispatch .signal-bars {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0.15rem;
  width: 100%;
}

.ft-home-dispatch .signal-bars__track {
  display: flex;
  gap: 4px;
  flex-wrap: nowrap;
}

.ft-home-dispatch .signal-bars__cell {
  width: 7px;
  height: 12px;
  flex-shrink: 0;
  background: #e5e1d8;
  border-radius: 1px;
}

.ft-home-dispatch .signal-bars__cell--on {
  background: var(--ft-ink);
}

.ft-home-dispatch .ft-sidebar__panel {
  padding: 0.85rem 1rem;
}

.ft-home-dispatch .ft-sidebar__card {
  padding-bottom: 0.65rem;
}

.ft-home-dispatch .ft-sidebar__card:last-child {
  padding-bottom: 0;
}

.ft-home-dispatch .ft-sidebar__card-title {
  margin-bottom: 0.38rem;
}

.ft-home-dispatch .ft-sidebar__stack {
  gap: 0.28rem;
}

.ft-home-dispatch .ft-sidebar__metric-row {
  gap: 0.22rem;
}

.ft-home-dispatch .ft-sidebar__legend {
  margin-top: 0.3rem;
  padding-top: 0.28rem;
}

.ft-home-dispatch .ft-home-early-strip {
  margin-top: 3rem;
  padding-top: 2rem;
  border-top: 1px solid var(--ft-line);
}

.ft-home-dispatch .ft-home-early-strip__label {
  margin: 0 0 0.35rem;
  font-size: 0.5625rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--ft-muted);
  opacity: 0.75;
}

.ft-home-dispatch .ft-home-early-strip__title {
  margin: 0 0 1.25rem;
  font-family: Georgia, "Times New Roman", serif;
  font-size: 1.35rem;
  font-weight: 600;
  color: var(--ft-ink);
  letter-spacing: -0.02em;
}

.ft-home-dispatch .ft-home-early-strip__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 28px;
}

.ft-home-dispatch .ft-home-early-card {
  margin: 0;
  padding: 0 20px 0 0;
  border-right: 1px solid var(--ft-line);
  min-width: 0;
}

.ft-home-dispatch .ft-home-early-card:last-child {
  border-right: none;
  padding-right: 0;
}

.ft-home-dispatch .ft-home-early-card__rank {
  display: block;
  font-family: Georgia, serif;
  font-size: 2rem;
  font-weight: 600;
  line-height: 1;
  color: var(--ft-rust);
  margin-bottom: 0.5rem;
}

.ft-home-dispatch .ft-home-early-card__name {
  margin: 0 0 0.35rem;
  font-family: Georgia, "Times New Roman", serif;
  font-size: 1.0625rem;
  font-weight: 600;
  color: var(--ft-ink);
  line-height: 1.25;
}

.ft-home-dispatch .ft-home-early-card__dish {
  margin: 0 0 0.65rem;
  font-size: 0.8125rem;
  line-height: 1.45;
  color: var(--ft-muted);
}

.ft-home-dispatch .ft-home-early-card__signal {
  margin: 0;
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ft-ink);
}

.ft-home-dispatch .ft-home-early-card__signal span {
  color: var(--ft-rust);
}

@media (max-width: 960px) {
  .ft-home-dispatch .ft-layout {
    display: block;
  }
  .ft-home-dispatch .ft-sidebar-panel-host .ft-sidebar {
    position: static;
    margin-top: 1.5rem;
    padding-top: 1.5rem;
    border-top: 1px solid var(--ft-line);
  }
}

@media (max-width: 767px) {
  .ft-home-dispatch .ft-hero {
    min-height: 300px;
    margin-bottom: 2rem;
    padding: 1.25rem 0 2.25rem;
    align-items: flex-start;
  }
  .ft-home-dispatch .ft-hero-copy {
    max-width: none;
    padding-right: 0;
  }
  .ft-home-dispatch .ft-hero h1 {
    font-size: clamp(2.75rem, 11vw, 3.75rem);
    line-height: 0.95;
  }
  .ft-home-dispatch .ft-hero-subtitle {
    font-size: clamp(1rem, 4vw, 1.25rem);
  }
  .ft-home-dispatch .ft-hero-art {
    width: 92%;
    max-width: none;
    opacity: 0.34;
    right: -14%;
    bottom: -14px;
  }
  .ft-home-dispatch .ft-home-early-strip__grid {
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }
  .ft-home-dispatch .ft-home-early-card {
    padding: 0 0 1.25rem;
    border-right: none;
    border-bottom: 1px solid var(--ft-line);
  }
  .ft-home-dispatch .ft-home-early-card:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }
  .ft-home-dispatch .ft-trend-row {
    padding: 22px 0;
  }
  .ft-home-dispatch .ft-trend-top {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
  .ft-home-dispatch .ft-where-row,
  .ft-home-dispatch .ft-why-row {
    grid-template-columns: 1fr;
    gap: 0;
  }
  .ft-home-dispatch .ft-trend-spacer {
    display: none;
  }
  .ft-home-dispatch .ft-rank-cell {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 10px;
  }
  .ft-home-dispatch .ft-signal-cell {
    border-left: none;
    padding-left: 0;
    border-top: 1px solid var(--ft-line);
    padding-top: 0.85rem;
  }
}
`;

const SAMPLE_RAIL_SIGNAL = {
  velocity: 83,
  adoption: 78,
  uniqueness: 81,
  staying: 76,
} as const;

async function getPayload(): Promise<LaFoodTrendsDataFile> {
  return readLaFoodTrendsDataFile();
}

function BlockBar({ filled }: { filled: number }) {
  const n = Math.min(10, Math.max(0, Math.round(filled)));
  return (
    <div className="ft-block-bar" aria-hidden>
      {Array.from({ length: 10 }, (_, i) => (
        <span key={i} className={i < n ? undefined : "empty"} />
      ))}
    </div>
  );
}

export default async function HomePage() {
  const payload = await getPayload();
  const rows = getDisplayPrimaryTrends(payload);
  const hasTrends = rows.length > 0;
  const shareUrl = "https://foodtrend.la/la-food";
  const earlyThree = getDisplayAboutToHit(payload);
  const aboutHitTitle = "Top 3 About to Hit";
  const freshness = getDataFreshnessSummary(payload);

  return (
    <main className="ft-page ft-home-dispatch">
      <style dangerouslySetInnerHTML={{ __html: HOME_DISPATCH_CSS }} />

      <header className="ft-header ft-hero">
        <div className="ft-hero-art">
          <img src="/images/la-skyline.png" alt="" />
        </div>
        <div className="ft-header__inner ft-hero-copy">
          <h1>Foodtrend LA</h1>
          <p className="ft-hero-subtitle">
            The dishes and drinks taking over LA right now.
          </p>
          <Link href="/la-food" className="ft-home-link">
            Open the full report →
          </Link>
        </div>
      </header>

      <div className="ft-layout">
        <div className="ft-main-col">
          <section aria-labelledby="preview-heading">
            <p className="ft-section-label">Snapshot</p>
            <h2 id="preview-heading" className="ft-section-title">
              {!hasTrends ? "Signals we're watching" : "What's trending on menus right now"}
            </h2>
            <p className="ft-section-support">
              {freshness ? `${freshness}. ` : ""}
              {!hasTrends
                ? "Full engine output—see the complete dispatch on the report page."
                : "Food, drinks, desserts—a snapshot of what's gaining traction on menus. Methodology and sources on the report."}
            </p>

            <div className="ft-home-report-rows">
              {rows.map((trend, idx) => {
                const rank = idx + 1;
                const rankStr = String(rank).padStart(2, "0");
                const title = trend.name;
                const wherePicks = mapTrendToWherePicks(trend);
                const description = trend.description.trim() || trend.whyItsEverywhere;
                const mostSpottedRest = getMostSpottedRestLine(title, wherePicks[0]);
                const worthSplurgeRest = getSplurgeRestLine(title, wherePicks);
                const easyEntryRest = getEntryRestLine(title, wherePicks);
                const whyBullets = splitWhy(trend.whyItsEverywhere);
                const score = trend.signalScore;
                const bars = barsFromSignalScore(score);
                const stage = stageArrowFromConfidence(trend.confidence);
                const headingId = `snapshot-trend-${rank}`;

                return (
                  <article
                    key={trend.id}
                    className="ft-trend-row"
                    aria-labelledby={headingId}
                  >
                    <div className="ft-trend-top">
                      <div className="ft-rank-cell">
                        <div className="ft-row-kicker">NO. {rankStr}</div>
                        <div className="ft-rank-number">{rankStr}</div>
                        <TrendIconForName name={title} />
                      </div>

                      <div className="ft-story-cell ft-story-cell--lead">
                        <h3 id={headingId}>{title}</h3>
                        <p className="ft-story-lede">{description}</p>
                      </div>

                      <div className="ft-signal-cell">
                        <div className="ft-signal-head">
                          <strong>SIGNAL {score}</strong>
                          <span>{stage}</span>
                        </div>
                        <div className="ft-bar-row">
                          <span>Menu Spread</span>
                          <BlockBar filled={bars.menu} />
                        </div>
                        <div className="ft-bar-row">
                          <span>Search Lift</span>
                          <BlockBar filled={bars.search} />
                        </div>
                        <div className="ft-bar-row">
                          <span>Social Mentions</span>
                          <BlockBar filled={bars.social} />
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
                          <WherePickList picks={wherePicks} />
                        </div>
                      </div>

                      <div className="ft-why-row">
                        <div className="ft-trend-spacer" aria-hidden />
                        <div className="ft-why-row-content">
                          <h4 className="ft-trend-label ft-trend-label--why">WHY IT&apos;S EVERYWHERE</h4>
                          <ul className="ft-why-list">
                            {whyBullets.map((line, i) => (
                              <li key={i}>{line}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <p className="ft-footer-note">
            Updated when the scout runs. Rankings are computed locally from open-web candidates—not
            paid placement.
          </p>
        </div>

        <div className="ft-sidebar-panel-host">
          <aside className="ft-sidebar" aria-label="Signal model and context">
            <div className="ft-sidebar__panel">
              <section className="ft-sidebar__card">
                <h3 className="ft-sidebar__card-title">Signal model</h3>
                <div className="ft-sidebar__card-body">
                  <div className="ft-sidebar__stack">
                    <div className="ft-sidebar__metric-row">
                      <span className="ft-sidebar__metric-label">Velocity</span>
                      <SignalBars value={pctToBarTen(SAMPLE_RAIL_SIGNAL.velocity)} />
                    </div>
                    <div className="ft-sidebar__metric-row">
                      <span className="ft-sidebar__metric-label">Adoption</span>
                      <SignalBars value={pctToBarTen(SAMPLE_RAIL_SIGNAL.adoption)} />
                    </div>
                    <div className="ft-sidebar__metric-row">
                      <span className="ft-sidebar__metric-label">Uniqueness</span>
                      <SignalBars value={pctToBarTen(SAMPLE_RAIL_SIGNAL.uniqueness)} />
                    </div>
                    <div className="ft-sidebar__metric-row">
                      <span className="ft-sidebar__metric-label">Staying power</span>
                      <SignalBars value={pctToBarTen(SAMPLE_RAIL_SIGNAL.staying)} />
                    </div>
                  </div>
                  <p className="ft-sidebar__legend">Low ···················· High</p>
                </div>
              </section>

              <section className="ft-sidebar__card">
                <h3 className="ft-sidebar__card-title">Drivers</h3>
                <div className="ft-sidebar__card-body">
                  <ul className="ft-sidebar__drivers">
                    <li>
                      <span className="ft-sidebar__driver-cell">
                        <span className="ft-sidebar__driver-dot" aria-hidden />
                        <span>Feed / Social</span>
                      </span>
                      <span className="ft-sidebar__tag">↑ HIGH</span>
                    </li>
                    <li>
                      <span className="ft-sidebar__driver-cell">
                        <span className="ft-sidebar__driver-dot" aria-hidden />
                        <span>Menu Duplication</span>
                      </span>
                      <span className="ft-sidebar__tag">↑ MED</span>
                    </li>
                    <li>
                      <span className="ft-sidebar__driver-cell">
                        <span className="ft-sidebar__driver-dot" aria-hidden />
                        <span>Chef Chatter</span>
                      </span>
                      <span className="ft-sidebar__tag">↑ HIGH</span>
                    </li>
                    <li>
                      <span className="ft-sidebar__driver-cell">
                        <span className="ft-sidebar__driver-dot" aria-hidden />
                        <span>Cultural Fit</span>
                      </span>
                      <span className="ft-sidebar__tag">↑ VERY HIGH</span>
                    </li>
                  </ul>
                </div>
              </section>

              <section className="ft-sidebar__card" id="home-report-method">
                <h3 className="ft-sidebar__card-title">About this report</h3>
                <div className="ft-sidebar__card-body">
                  <p className="ft-sidebar__text">
                    Snapshot rankings from open menus and local signals—full methodology and sources on the report
                    page.
                  </p>
                </div>
              </section>

              <section className="ft-sidebar__card">
                <h3 className="ft-sidebar__card-title">
                  <span className="ft-sidebar__title-icon" aria-hidden>
                    <SourceDatabaseIcon />
                  </span>
                  Data sources
                </h3>
                <div className="ft-sidebar__card-body">
                  <ul className="ft-sidebar__list">
                    <li>Menus from 2,400+ restaurants (public listings &amp; PDFs)</li>
                    <li>Instagram, TikTok, X — surface mentions &amp; clips</li>
                    <li>Google Trends — relative search lift by menu phrase</li>
                  </ul>
                </div>
              </section>

              <section className="ft-sidebar__card">
                <h3 className="ft-sidebar__card-title">Share this report</h3>
                <div className="ft-sidebar__card-body">
                  <div className="ft-sidebar__share-row">
                    <Link href="/la-food" className="ft-sidebar__share-circle" aria-label="Link to full report">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                        <path
                          d="M10 13a5 5 0 0 1 7.07 0l1.41 1.41a5 5 0 1 1-7.07 7.07l-1.06-1.06"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />
                        <path
                          d="M14 11a5 5 0 0 1-7.07 0L5.52 9.59a5 5 0 1 1 7.07-7.07l1.06 1.06"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />
                      </svg>
                    </Link>
                    <a
                      href={`https://twitter.com/intent/tweet?text=${encodeURIComponent("Foodtrend LA — LA menu culture")}&url=${encodeURIComponent(shareUrl)}`}
                      className="ft-sidebar__share-circle"
                      aria-label="Share on X"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                      </svg>
                    </a>
                    <a
                      href="https://instagram.com/"
                      className="ft-sidebar__share-circle"
                      aria-label="Instagram"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                        <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.5" />
                        <circle cx="12" cy="12" r="4.25" stroke="currentColor" strokeWidth="1.5" />
                        <circle cx="17.25" cy="6.75" r="1.25" fill="currentColor" />
                      </svg>
                    </a>
                    <a
                      href="mailto:hello@foodtrend.la?subject=Foodtrend%20LA"
                      className="ft-sidebar__share-circle"
                      aria-label="Email"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                        <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
                        <path d="M4 7l8 6 8-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </a>
                  </div>
                </div>
              </section>
            </div>
          </aside>
        </div>
      </div>

      {earlyThree.length > 0 ? (
        <section className="ft-home-early-strip" aria-labelledby="early-hit-heading">
          <p className="ft-home-early-strip__label">Early signals</p>
          <h2 id="early-hit-heading" className="ft-home-early-strip__title">
            {aboutHitTitle}
          </h2>
          <div className="ft-home-early-strip__grid">
            {earlyThree.map((item, earlyIdx) => {
              const rnk = String(earlyIdx + 1).padStart(2, "0");
              return (
                <article key={item.id} className="ft-home-early-card">
                  <span className="ft-home-early-card__rank">{rnk}</span>
                  <h3 className="ft-home-early-card__name">{item.name}</h3>
                  <p className="ft-home-early-card__dish">
                    {item.menuItems[0]?.trim() || item.description || "—"}
                  </p>
                  <p className="ft-home-early-card__signal">
                    Signal <span>{item.signalScore}</span> · {stageArrowFromConfidence(item.confidence)}
                  </p>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}
    </main>
  );
}
