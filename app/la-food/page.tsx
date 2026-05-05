import Link from "next/link";
import { SourceDatabaseIcon } from "@/components/foodtrend/FoodTrendIcons";
import { TrendIconForName } from "@/components/foodtrend/TrendIconForName";
import { pctToBarTen, SignalBars } from "@/components/foodtrend/SignalBars";
import TrendRow from "@/components/foodtrend/TrendRow";
import type { FtTrendRowProps } from "@/components/foodtrend/TrendRow";
import { HeaderAtmosphere } from "@/components/HeaderAtmosphere";
import {
  getMostSpottedRestLine,
  getSplurgeRestLine,
  getEntryRestLine,
} from "@/lib/whereShowing";
import {
  barsFromSignalScore,
  getDataFreshnessSummary,
  formatUpdatedLabel,
  getDisplayAboutToHit,
  getDisplayPrimaryTrends,
  mapTrendToWherePicks,
  readLaFoodTrendsDataFile,
  stageArrowFromConfidence,
} from "@/lib/laFoodTrendsData";
import { splitWhy } from "@/lib/trendText";
import type { Trend } from "@/types/laFoodTrend";

function trendToFtRow(trend: Trend, rank: number): FtTrendRowProps {
  const rankNum = String(rank).padStart(2, "0");
  const whereItems = mapTrendToWherePicks(trend);
  return {
    rankKicker: `NO. ${rankNum}`,
    rankNum,
    icon: <TrendIconForName name={trend.name} />,
    title: trend.name,
    description: trend.description,
    why: splitWhy(trend.whyItsEverywhere),
    whereItems,
    mostSpottedRest: getMostSpottedRestLine(trend.name, whereItems[0]),
    worthSplurgeRest: getSplurgeRestLine(trend.name, whereItems),
    easyEntryRest: getEntryRestLine(trend.name, whereItems),
    signal: trend.signalScore,
    stage: stageArrowFromConfidence(trend.confidence),
    bars: barsFromSignalScore(trend.signalScore),
    whyItWorks: trend.whyItWorks,
  };
}

const SAMPLE_RAIL_SIGNAL = {
  velocity: 83,
  adoption: 78,
  uniqueness: 81,
  staying: 76,
} as const;

export const dynamic = "force-dynamic";

export default async function LaFoodPage() {
  const trendsDoc = await readLaFoodTrendsDataFile();
  const freshness = getDataFreshnessSummary(trendsDoc, { includeDate: false });
  const updatedLabel = formatUpdatedLabel(trendsDoc);
  const reportTrends = getDisplayPrimaryTrends(trendsDoc);
  const aboutRows = getDisplayAboutToHit(trendsDoc);

  const shareUrl = "https://foodtrend.la/la-food";

  return (
    <main className="ft-report-page">
      <header className="ft-hero">
        <div className="ft-hero__inner">
          <div className="ft-hero__copy">
            <h1 className="ft-hero__title">Foodtrend LA</h1>
            <p className="ft-hero__subtitle">
              The dishes, drinks, and desserts taking over LA menus right now.
              {freshness ? ` ${freshness}.` : ""}
            </p>
            <p className="ft-hero__nav">
              <Link href="/">← Front page</Link>
            </p>
            {updatedLabel ? <p className="ft-data-updated">{updatedLabel}</p> : null}
          </div>
          <div className="ft-hero__art" aria-hidden>
            <HeaderAtmosphere variant="hero" />
          </div>
        </div>
      </header>

      <section className="ft-layout">
        <div className="ft-report-main">
          <header className="ft-intro">
            <p className="ft-intro__kicker">Report</p>
            <h2 id="ft-report-heading" className="ft-intro__title">
              What&apos;s trending on menus right now
            </h2>
            <p className="ft-intro__dek">
              Patterns repeated across menus—not single-restaurant moments.
            </p>
          </header>

          <div className="ft-report-trends">
            {reportTrends.map((trend, i) => (
              <TrendRow key={trend.id} {...trendToFtRow(trend, i + 1)} />
            ))}
          </div>

          <section className="ft-early" aria-labelledby="ft-early-heading">
            <div className="ft-early__layout">
              <header className="ft-early__head">
                <h2 id="ft-early-heading" className="ft-early__title-row">
                  <span className="ft-early__kicker">Early signals</span>
                  <span className="ft-early__title-main">3 about to hit</span>
                </h2>
                <p className="ft-early__dek">
                  Watchlist menu items gaining traction before they duplicate across unrelated kitchens.
                </p>
              </header>
              <div className="ft-early__cards">
                {aboutRows.map((trend) => {
                  const bullets = splitWhy(trend.whyItsEverywhere);
                  const b0 = bullets[0] ?? "—";
                  const b1 = bullets[1] ?? b0;
                  const foot =
                    trend.restaurants[0] && trend.menuItems[0]
                      ? `${trend.restaurants[0].name} — ${trend.menuItems[0]}`
                      : (trend.menuItems[0] ?? trend.description);
                  return (
                    <div key={trend.id} className="ft-early__card">
                      <div className="ft-early__card-head">
                        <span className="ft-early__card-icon" aria-hidden>
                          <TrendIconForName name={trend.name} />
                        </span>
                        <div className="ft-early__card-main">
                          <p className="ft-early__card-status">
                            {stageArrowFromConfidence(trend.confidence)}
                          </p>
                          <h3 className="ft-early__card-name">{trend.name}</h3>
                        </div>
                        <span
                          className="ft-early__card-score"
                          aria-label={`Signal ${trend.signalScore}`}
                        >
                          Signal {trend.signalScore}
                        </span>
                      </div>
                      <ul className="ft-early__card-bullets">
                        <li>{b0}</li>
                        <li>{b1}</li>
                      </ul>
                      <p className="ft-early__card-foot">{foot}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        </div>

        <aside className="ft-sidebar">
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

            <section className="ft-sidebar__card" id="report-method">
              <h3 className="ft-sidebar__card-title">About this report</h3>
              <div className="ft-sidebar__card-body">
                <p className="ft-sidebar__text">
                  A quarterly editorial read on dish-level momentum in Los Angeles: where formats repeat, why they
                  resonate, and which rooms are surfacing them first—distilled from menus and open-web chatter.
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
                  <li>Reddit chatter — LA food subs (official API; dish &amp; neighborhood signals)</li>
                  <li>Google Trends — relative search lift by menu phrase</li>
                </ul>
              </div>
            </section>

            <section className="ft-sidebar__card">
              <h3 className="ft-sidebar__card-title">Share this report</h3>
              <div className="ft-sidebar__card-body">
                <div className="ft-sidebar__share-row">
                  <Link href="/la-food" className="ft-sidebar__share-circle" aria-label="Link to this report">
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
                    href={`https://twitter.com/intent/tweet?text=${encodeURIComponent("Foodtrend LA — LA menu culture report")}&url=${encodeURIComponent(shareUrl)}`}
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
      </section>

      <footer className="ft-report-footer">
        <div className="ft-report-footer__brand">
          <span className="ft-report-footer__mark">M</span>
          <span className="ft-report-footer__sub">California</span>
        </div>
        <span className="ft-report-footer__copyright">Foodtrend LA © 2024</span>
        <div className="ft-report-footer__links">
          <Link href="/">About</Link>
          <a href="#report-method">Methodology</a>
          <a href="mailto:hello@foodtrend.la?subject=Foodtrend%20LA">Subscribe</a>
        </div>
      </footer>
    </main>
  );
}
