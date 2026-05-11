import Link from "next/link";
import { EditorialVenueLine } from "@/components/foodtrend/EditorialVenueLine";
import TrendRow from "@/components/foodtrend/TrendRow";
import {
  formatUpdatedLabel,
  getDataFreshnessSummary,
  mapTrendToWherePicks,
  sortTrendsBySignalDesc,
  readLaFoodTrendsDataFile,
  stageArrowFromConfidence,
} from "@/lib/laFoodTrendsData";
import { trendToEditorialCardProps } from "@/lib/editorialTrendCardProps";
import type { LaFoodTrendsDataFile } from "@/types/laFoodTrend";

export const dynamic = "force-dynamic";

const HOME_DISPATCH_CSS = `
.ft-home-dispatch {
  --ft-line: #d9d5c9;
  --ft-rust: #b8523f;
  --ft-ink: #0b1d35;
  --ft-muted: #697386;
  --ft-hero-cream: #fdfaf5;
  --ft-hero-rule: #ded8cb;
  --ft-hero-title: #081a33;
  --ft-hero-cta: #914e36;
}

/* Full-bleed masthead (cream extends edge-to-edge; content aligns to .ft-page width) */
.ft-home-dispatch .ft-home-hero-shell {
  position: relative;
  width: 100vw;
  margin-left: calc(50% - 50vw);
  margin-right: calc(50% - 50vw);
  overflow: hidden;
  background: var(--ft-hero-cream);
  border-bottom: 1px solid var(--ft-hero-rule);
  padding-top: 56px;
  padding-bottom: 36px;
  margin-bottom: 28px;
}

.ft-home-dispatch .ft-home-hero-frame {
  position: relative;
  z-index: 2;
  max-width: 1320px;
  margin: 0 auto;
  padding-left: 48px;
  padding-right: 48px;
}

.ft-home-dispatch .ft-home-hero-shell .ft-hero-copy {
  position: relative;
  z-index: 2;
  max-width: 620px;
  padding-right: 1.5rem;
}

.ft-home-dispatch .ft-hero-masthead {
  margin: 0 0 16px;
  padding: 0;
  font-family: Georgia, "Times New Roman", serif;
  font-weight: 600;
  letter-spacing: -0.04em;
  color: var(--ft-hero-title);
}

.ft-home-dispatch .ft-hero-masthead__line {
  display: block;
  font-size: 88px;
  line-height: 0.86;
}

@media (min-width: 768px) {
  .ft-home-dispatch .ft-hero-masthead__line {
    font-size: 112px;
  }
}

.ft-home-dispatch .ft-hero-subtitle {
  margin: 0 0 16px;
  max-width: 28rem;
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial,
    sans-serif;
  font-size: 22px;
  line-height: 1.4;
  color: var(--ft-muted);
  font-weight: 400;
}

.ft-home-dispatch .ft-home-hero-shell .ft-home-link {
  display: inline-block;
  margin: 0 0 12px;
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--ft-hero-cta);
  text-decoration: none;
}

.ft-home-dispatch .ft-home-hero-shell .ft-home-link:hover {
  text-decoration: underline;
  text-underline-offset: 3px;
}

.ft-home-dispatch .ft-home-hero-shell .ft-data-updated {
  margin: 0;
  font-size: 0.75rem;
  line-height: 1.4;
  color: var(--ft-muted);
}

.ft-home-dispatch .ft-home-hero-shell .ft-hero-art {
  position: absolute;
  z-index: 0;
  left: 360px;
  right: auto;
  top: 28px;
  bottom: auto;
  width: 980px;
  max-width: none;
  opacity: 0.68;
  pointer-events: none;
  -webkit-mask-image: linear-gradient(
    to right,
    rgba(0, 0, 0, 0.18) 0%,
    rgba(0, 0, 0, 0.65) 16%,
    rgba(0, 0, 0, 1) 30%,
    rgba(0, 0, 0, 1) 100%
  );
  mask-image: linear-gradient(
    to right,
    rgba(0, 0, 0, 0.18) 0%,
    rgba(0, 0, 0, 0.65) 16%,
    rgba(0, 0, 0, 1) 30%,
    rgba(0, 0, 0, 1) 100%
  );
  -webkit-mask-size: 100% 100%;
  mask-size: 100% 100%;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
}

.ft-home-dispatch .ft-home-hero-shell .ft-hero-art img {
  width: 100%;
  height: auto;
  display: block;
  transform: translateY(18%);
  filter: contrast(1.08) brightness(0.96) blur(0.2px);
}

.ft-home-dispatch .ft-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 12px;
  align-items: start;
}

@media (min-width: 900px) {
  .ft-home-dispatch > .ft-page {
    max-width: 1320px;
    padding-top: 0;
    padding-right: 48px;
    padding-bottom: 48px;
    padding-left: 48px;
  }
}

.ft-home-dispatch .ft-main-col .ft-section-label {
  margin: 0 0 10px;
}

.ft-home-dispatch .ft-section-title {
  margin: 0 0 14px;
}

.ft-home-dispatch .ft-section-support {
  margin: 0 0 18px;
}

.ft-home-dispatch .ft-home-report-rows > .ft-editorial-card {
  width: 100%;
  max-width: 980px;
}

.ft-home-dispatch .ft-home-report-rows {
  margin-top: 0;
}

@media (min-width: 961px) {
  /* Align About rail with snapshot headline (main column has section kicker above title). */
  .ft-home-dispatch .ft-sidebar-panel-host {
    margin-top: 1.375rem;
  }
}

.ft-home-dispatch .ft-sidebar-panel-host .ft-sidebar {
  position: sticky;
  top: 1rem;
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

@media (max-width: 899px) {
  .ft-home-dispatch .ft-home-hero-frame {
    padding-left: 22px;
    padding-right: 22px;
  }
  .ft-home-dispatch .ft-home-hero-shell .ft-hero-art {
    left: clamp(140px, 36vw, 360px);
    width: min(980px, calc(100vw - 28px));
  }
}

@media (max-width: 767px) {
  .ft-home-dispatch .ft-home-hero-shell {
    padding-top: 56px;
    padding-bottom: 36px;
    margin-bottom: 1.25rem;
  }
  .ft-home-dispatch .ft-home-hero-shell .ft-hero-copy {
    max-width: none;
    padding-right: 0;
  }
  .ft-home-dispatch .ft-hero-masthead__line {
    font-size: clamp(3.25rem, 14vw, 4.75rem);
    line-height: 0.86;
  }
  .ft-home-dispatch .ft-hero-subtitle {
    font-size: clamp(1rem, 4vw, 1.25rem);
  }
  .ft-home-dispatch .ft-home-hero-shell .ft-hero-art {
    left: 8px;
    right: auto;
    top: 38px;
    width: min(980px, calc(100vw - 16px));
    opacity: 0.68;
  }
  .ft-home-dispatch .ft-home-hero-shell .ft-hero-art img {
    transform: translateY(14%);
    filter: contrast(1.08) brightness(0.96) blur(0.2px);
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
}
`;

async function getPayload(): Promise<LaFoodTrendsDataFile> {
  return readLaFoodTrendsDataFile();
}

export default async function HomePage() {
  const payload = await getPayload();
  const rows = sortTrendsBySignalDesc(payload.trends ?? []);
  const hasTrends = rows.length > 0;
  const earlyThree = sortTrendsBySignalDesc(payload.aboutToHit ?? []);
  const aboutHitTitle =
    earlyThree.length > 0 ? `Top ${earlyThree.length} About to Hit` : "About to Hit";
  const freshness = getDataFreshnessSummary(payload, { includeDate: false });
  const updatedLabel = formatUpdatedLabel(payload);

  return (
    <main className="ft-home-dispatch">
      <style dangerouslySetInnerHTML={{ __html: HOME_DISPATCH_CSS }} />

      <header className="ft-header ft-hero ft-home-hero-shell">
        <div className="ft-hero-art" aria-hidden>
          <img src="/images/la-skyline.png" alt="" />
        </div>
        <div className="ft-home-hero-frame">
          <div className="ft-header__inner ft-hero-copy">
            <h1 className="ft-hero-masthead">
              <span className="ft-hero-masthead__line">Foodtrend</span>
              <span className="ft-hero-masthead__line">LA</span>
            </h1>
            <p className="ft-hero-subtitle">
              The dishes and drinks taking over LA right now.
            </p>
            <Link href="/la-food" className="ft-home-link">
              Open the full report →
            </Link>
            {updatedLabel ? <p className="ft-data-updated">{updatedLabel}</p> : null}
          </div>
        </div>
      </header>

      <div className="ft-page">
        <div className="ft-layout">
          <div className="ft-main-col">
            <section aria-labelledby="preview-heading">
              <p className="ft-section-label">Snapshot</p>
              <h2 id="preview-heading" className="ft-section-title">
                {!hasTrends ? "Signals we're watching" : "What people are ordering right now in LA"}
              </h2>
              <p className="ft-section-support">
                {freshness ? `${freshness}. ` : ""}
                {!hasTrends
                  ? "Full engine output—see the complete dispatch on the report page."
                  : "Food, drinks, desserts—a snapshot of what's gaining traction on menus. Methodology and sources on the report."}
              </p>

              <div className="ft-home-report-rows">
                {rows.map((trend, idx) => (
                  <TrendRow key={trend.id} {...trendToEditorialCardProps(trend, idx + 1, rows)} />
                ))}
              </div>
            </section>

            <p className="ft-footer-note">
              Updated when the scout runs. Rankings are blended from open menus and local intel—not paid
              placement.
            </p>
            <p className="mt-2 text-[11px] text-[#8a8883]">
              {/* TODO: Password protect /admin before public production use. */}
              <Link href="/admin" className="opacity-70 hover:opacity-100">
                Admin
              </Link>
            </p>
          </div>

            <div className="ft-sidebar-panel-host">
            <aside className="ft-sidebar" aria-label="About this report">
              <div className="ft-sidebar__panel">
                <section className="ft-sidebar__card" id="home-report-method">
                  <h3 className="ft-sidebar__card-title">About this report</h3>
                  <div className="ft-sidebar__card-body">
                    <p className="ft-sidebar__text">
                      Snapshot rankings from open menus and local signals—full methodology on the report page.
                    </p>
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
              const venuePicks = mapTrendToWherePicks(item).slice(0, 3);
              return (
                <article key={item.id} className="ft-home-early-card">
                  <span className="ft-home-early-card__rank">{rnk}</span>
                  <h3 className="ft-home-early-card__name">{item.name}</h3>
                  <p className="ft-home-early-card__dish">
                    {item.menuItems[0]?.trim() || item.description || "—"}
                  </p>
                  {venuePicks.length > 0 ? (
                    <div className="ft-home-early-card__venues">
                      {venuePicks.map((pick, vi) => (
                        <EditorialVenueLine key={`${pick.restaurant}-${vi}`} pick={pick} variant="compact" />
                      ))}
                    </div>
                  ) : null}
                  <p className="ft-home-early-card__signal">
                    Heat <span>{item.signalScore}</span> · {stageArrowFromConfidence(item.confidence)}
                  </p>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}
      </div>
    </main>
  );
}
