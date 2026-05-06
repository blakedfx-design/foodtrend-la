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

.ft-home-dispatch .ft-sidebar-panel-host .ft-sidebar {
  position: sticky;
  top: 1.5rem;
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
          {updatedLabel ? <p className="ft-data-updated">{updatedLabel}</p> : null}
        </div>
      </header>

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
            Updated when the scout runs. Rankings are computed locally from open-web candidates—not
            paid placement.
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
