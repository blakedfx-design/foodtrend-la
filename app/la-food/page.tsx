import Link from "next/link";
import { getRestaurantUrl, pickHasInstagramLink } from "@/components/foodtrend/wherePick";
import { TrendIconForName } from "@/components/foodtrend/TrendIconForName";
import TrendRow from "@/components/foodtrend/TrendRow";
import { HeaderAtmosphere } from "@/components/HeaderAtmosphere";
import {
  getDataFreshnessSummary,
  formatUpdatedLabel,
  getDisplayAboutToHit,
  getDisplayPrimaryTrends,
  readLaFoodTrendsDataFile,
  stageArrowFromConfidence,
} from "@/lib/laFoodTrendsData";
import { trendToEditorialCardProps } from "@/lib/editorialTrendCardProps";
import { whyLinesForEditorialCard } from "@/lib/trendText";

export const dynamic = "force-dynamic";

export default async function LaFoodPage() {
  const trendsDoc = await readLaFoodTrendsDataFile();
  const freshness = getDataFreshnessSummary(trendsDoc, { includeDate: false });
  const updatedLabel = formatUpdatedLabel(trendsDoc);
  const reportTrends = getDisplayPrimaryTrends(trendsDoc);
  const aboutRows = getDisplayAboutToHit(trendsDoc);

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
              What people are ordering right now in LA
            </h2>
            <p className="ft-intro__dek">
              Patterns repeated across menus—not single-restaurant moments.
            </p>
          </header>

          <div className="ft-report-trends">
            {reportTrends.map((trend, i) => (
              <TrendRow key={trend.id} {...trendToEditorialCardProps(trend, i + 1, reportTrends)} />
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
                  const bullets = whyLinesForEditorialCard(trend.whyItsEverywhere, trend.whyItWorks);
                  const b0 = bullets[0] ?? "—";
                  const b1 = bullets[1] ?? b0;
                  const earlyThumbSrc =
                    trend.id === "ube-cheesecake" &&
                    typeof trend.heroImageUrl === "string" &&
                    trend.heroImageUrl.startsWith("/editorial/food/")
                      ? trend.heroImageUrl
                      : null;
                  const r0 = trend.restaurants[0];
                  const dish0 = trend.menuItems[0]?.trim();
                  const footHref = r0 ? getRestaurantUrl(r0) : null;
                  const showFootIgGlyph = r0 ? pickHasInstagramLink(r0) : false;
                  const foot =
                    r0 && dish0 ? (
                      footHref ? (
                        <>
                          <a
                            href={footHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ft-early__card-rest-link"
                          >
                            {r0.name}
                            {showFootIgGlyph ? (
                              <span className="ft-early__card-rest-glyph" aria-hidden>
                                {" "}
                                ↗
                              </span>
                            ) : null}
                          </a>
                          <span className="ft-early__card-rest-detail"> — {dish0}</span>
                        </>
                      ) : (
                        <>
                          <span>{r0.name}</span>
                          <span> — {dish0}</span>
                        </>
                      )
                    ) : (
                      (trend.menuItems[0]?.trim() ?? trend.description)
                    );
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
                      {earlyThumbSrc ? (
                        <figure className="ft-early__card-thumb">
                          {/* eslint-disable-next-line @next/next/no-img-element -- curated local trend thumbnail */}
                          <img src={earlyThumbSrc} alt="" className="ft-early__card-thumb-img" loading="lazy" />
                        </figure>
                      ) : null}
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

        <aside className="ft-sidebar" aria-label="About this report">
          <div className="ft-sidebar__panel">
            <section className="ft-sidebar__card" id="report-method">
              <h3 className="ft-sidebar__card-title">About this report</h3>
              <div className="ft-sidebar__card-body">
                <p className="ft-sidebar__text">
                  A quarterly editorial read on dish-level momentum in Los Angeles: where formats repeat, why they
                  resonate, and which rooms are surfacing them first—distilled from menus and open-web chatter.
                </p>
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
