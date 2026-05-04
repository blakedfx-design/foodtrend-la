import type { ReactElement } from "react";
import Link from "next/link";
import {
  BurgerIcon,
  IzakayaIcon,
  ChiliJarIcon,
  BagelIcon,
  FermentJarIcon,
  SnackBowlIcon,
  SoftServeIcon,
  SourceDatabaseIcon,
} from "@/components/foodtrend/FoodTrendIcons";
import { pctToBarTen, SignalBars } from "@/components/foodtrend/SignalBars";
import TrendRow from "@/components/foodtrend/TrendRow";
import type { FtTrendRowProps } from "@/components/foodtrend/TrendRow";
import { HeaderAtmosphere } from "@/components/HeaderAtmosphere";
import { WHERE_SHOWING_PICKS, getMostSpottedRestLine } from "@/lib/whereShowing";

function barFilled(pct: number): number {
  return Math.min(10, Math.max(0, Math.round(pct / 10)));
}

const REPORT_ROWS: FtTrendRowProps[] = [
  {
    rankKicker: "NO. 01",
    rankNum: "01",
    icon: <BurgerIcon />,
    title: "Thick Burgers",
    description: "Thick, stacked patties. Premium builds. Heavier profiles.",
    why: ["Indulgence over minimalism", "Strong visual and social appeal", "Late-night comfort overlap"],
    whereItems: [...WHERE_SHOWING_PICKS["Thick Burgers"]],
    mostSpottedRest: getMostSpottedRestLine("Thick Burgers"),
    signal: 10,
    stage: "↑ PEAK",
    bars: { menu: 9, search: 8, social: 7 },
  },
  {
    rankKicker: "NO. 02",
    rankNum: "02",
    icon: <IzakayaIcon />,
    title: "Izakayas Everywhere",
    description: "Skewers, sake pacing, and small plates spreading beyond Little Tokyo into tasting menus and wine bars.",
    why: ["Social format that stretches checks without stiffness", "Menus rotate nightly without new concepts", "Guests learn the rhythm fast"],
    whereItems: [...WHERE_SHOWING_PICKS["Izakayas Everywhere"]],
    mostSpottedRest: getMostSpottedRestLine("Izakayas Everywhere"),
    signal: 9,
    stage: "↑ PEAK",
    bars: { menu: barFilled(90), search: barFilled(82), social: barFilled(86) },
  },
  {
    rankKicker: "NO. 03",
    rankNum: "03",
    icon: <ChiliJarIcon />,
    title: "Chili Crisp Breakfasts",
    description: "Morning menus borrowing savory heat—eggs, burritos, hashes finished with crisp or oil.",
    why: ["Savory shift away from sweet brunch", "Pantry ingredients crossing dayparts", "Handheld builds that read on camera"],
    whereItems: [...WHERE_SHOWING_PICKS["Chili Crisp Breakfasts"]],
    mostSpottedRest: getMostSpottedRestLine("Chili Crisp Breakfasts"),
    signal: 8,
    stage: "↑ HIGH",
    bars: { menu: barFilled(82), search: barFilled(78), social: barFilled(84) },
  },
  {
    rankKicker: "NO. 04",
    rankNum: "04",
    icon: <FermentJarIcon />,
    title: "Fermented Everything",
    description: "Miso, koji, pickles, and lacto ferments as core flavor in mains—not garnish.",
    why: ["Premium veg narrative still sells", "Depth without heavier fats", "Shorter programs than bread"],
    whereItems: [...WHERE_SHOWING_PICKS["Fermented Everything"]],
    mostSpottedRest: getMostSpottedRestLine("Fermented Everything"),
    signal: 7,
    stage: "↑ HIGH",
    bars: { menu: barFilled(76), search: barFilled(72), social: barFilled(74) },
  },
  {
    rankKicker: "NO. 05",
    rankNum: "05",
    icon: <SnackBowlIcon />,
    title: "Snacks Are the New Starters",
    description: "Compact first bites replacing composed appetizers—built for grazing and passing mid-table.",
    why: ["Variety without appetizer pricing", "Shorter attention spans", "Social trays"],
    whereItems: [...WHERE_SHOWING_PICKS["Snacks Are the New Starters"]],
    mostSpottedRest: getMostSpottedRestLine("Snacks Are the New Starters"),
    signal: 7,
    stage: "↑ HIGH",
    bars: { menu: barFilled(74), search: barFilled(68), social: barFilled(76) },
  },
];

const SAMPLE_RAIL_SIGNAL = {
  velocity: 83,
  adoption: 78,
  uniqueness: 81,
  staying: 76,
} as const;

type EarlyCard = {
  title: string;
  stage: string;
  signalDisplay: string;
  bullets: [string, string];
  menuLine: string;
  icon: ReactElement;
};

const SAMPLE_EARLY: EarlyCard[] = [
  {
    title: "Fermented Bagels",
    stage: "↑ RISING",
    signalDisplay: "7.8",
    bullets: ["Long-ferment drops selling out by noon.", "Schmears leaning savory and seeded."],
    menuLine: "Courtyard — Weekend sourdough bagel",
    icon: <BagelIcon />,
  },
  {
    title: "Chili Crisp Breakfast",
    stage: "↑ EMERGING",
    signalDisplay: "7.2",
    bullets: ["Eastside brunch lines testing chili-on-egg builds.", "Retail chili crisps landing on cafés."],
    menuLine: "Smorgasburg LA — Crispy chili egg wrap",
    icon: <ChiliJarIcon />,
  },
  {
    title: "Soft Serve Collisions",
    stage: "↑ EARLY",
    signalDisplay: "6.9",
    bullets: ["Two-flavor swirls with savory crumbs.", "Night-window dessert-only queues."],
    menuLine: "Gjelina — Olive oil & flake hybrid cone",
    icon: <SoftServeIcon />,
  },
];

export default function LaFoodPage() {
  const shareUrl = "https://foodtrend.la/la-food";

  return (
    <main className="ft-report-page">
      <header className="ft-hero">
        <div className="ft-hero__inner">
          <div className="ft-hero__copy">
            <h1 className="ft-hero__title">Foodtrend LA</h1>
            <p className="ft-hero__subtitle">
              The dishes, drinks, and desserts taking over LA menus right now.
            </p>
            <p className="ft-hero__nav">
              <Link href="/">← Front page</Link>
            </p>
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
            {REPORT_ROWS.map((row) => (
              <TrendRow key={row.rankNum} {...row} />
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
                {SAMPLE_EARLY.map((item) => (
                  <div key={item.title} className="ft-early__card">
                    <div className="ft-early__card-head">
                      <span className="ft-early__card-icon" aria-hidden>
                        {item.icon}
                      </span>
                      <div className="ft-early__card-main">
                        <p className="ft-early__card-status">{item.stage}</p>
                        <h3 className="ft-early__card-name">{item.title}</h3>
                      </div>
                      <span className="ft-early__card-score" aria-label={`Signal ${item.signalDisplay}`}>
                        Signal {item.signalDisplay}
                      </span>
                    </div>
                    <ul className="ft-early__card-bullets">
                      <li>{item.bullets[0]}</li>
                      <li>{item.bullets[1]}</li>
                    </ul>
                    <p className="ft-early__card-foot">{item.menuLine}</p>
                  </div>
                ))}
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
