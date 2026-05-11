import Link from "next/link";

export type AdminNavKey = "overview" | "editorial" | "analytics" | "system";
export type HealthTone = "green" | "yellow" | "red" | "neutral";

type NavItem = { key: AdminNavKey; label: string; href: string };

const NAV_ITEMS: NavItem[] = [
  { key: "overview", label: "Overview", href: "/admin" },
  { key: "editorial", label: "Editorial", href: "/admin/editorial" },
  { key: "analytics", label: "Analytics", href: "/admin/analytics" },
  { key: "system", label: "System", href: "/admin/analytics#system-info" },
];

export function tonePillClass(tone: HealthTone): string {
  if (tone === "green") return "border-green-200 bg-green-50 text-green-700";
  if (tone === "yellow") return "border-amber-200 bg-amber-50 text-amber-700";
  if (tone === "red") return "border-red-200 bg-red-50 text-red-700";
  return "border-neutral-200 bg-neutral-50 text-neutral-700";
}

export function toneDotClass(tone: HealthTone): string {
  if (tone === "green") return "bg-green-500";
  if (tone === "yellow") return "bg-amber-500";
  if (tone === "red") return "bg-red-500";
  return "bg-neutral-400";
}

export function statusTone(status: string): HealthTone {
  if (status === "green") return "green";
  if (status === "yellow") return "yellow";
  if (status === "red") return "red";
  return "neutral";
}

export function AdminScaffold(props: {
  navKey: AdminNavKey;
  breadcrumb: string;
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[#f5f1e8] px-3 py-4 text-[#1f2937] sm:px-4 md:py-4 lg:px-6 xl:px-7 2xl:px-9">
      <div className="mx-auto grid w-full max-w-[1920px] grid-cols-1 gap-5 lg:grid-cols-[212px_minmax(0,1fr)] lg:gap-6 2xl:max-w-[2200px]">
        <aside className="h-fit rounded-2xl border border-[#e8e1d3] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] lg:sticky lg:top-4 lg:p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6b6358]">
            Foodtrend LA Admin
          </p>
          <p className="mt-1 text-xs leading-snug text-[#7a7165]">Internal newsroom control room</p>
          <nav className="mt-5 space-y-1">
            {NAV_ITEMS.map((item) => {
              const active = props.navKey === item.key;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={`flex items-center justify-between rounded-xl border px-3 py-2 text-sm transition-colors duration-150 ${
                    active
                      ? "border-[#d2e9da] bg-[#ecf8f0] text-[#1b5e3a]"
                      : "border-transparent text-[#4b5563] hover:border-[#e5e7eb] hover:bg-[#fafaf9]"
                  }`}
                >
                  <span>{item.label}</span>
                  {active ? <span className="h-2 w-2 rounded-full bg-[#2f8f5b]" /> : null}
                </Link>
              );
            })}
          </nav>
        </aside>

        <section className="min-w-0 space-y-5 lg:border-l lg:border-[#e3dcc9] lg:pl-6 xl:pl-7">
          <header className="rounded-2xl border border-[#e8e1d3] bg-white px-4 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:px-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6b6358]">
              {props.breadcrumb}
            </p>
            <div className="mt-2.5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h1 className="text-[1.6rem] font-semibold tracking-tight text-[#17202b] md:text-[1.7rem]">{props.title}</h1>
                <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-[#4b5563]">{props.subtitle}</p>
              </div>
              {props.actions ? <div className="flex flex-wrap gap-2">{props.actions}</div> : null}
            </div>
          </header>
          {props.children}
        </section>
      </div>
    </main>
  );
}

export function Card(props: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  /** Tighter padding and type — operations/footer density */
  compact?: boolean;
}) {
  const compact = props.compact === true;
  return (
    <section
      className={`rounded-2xl border border-[#e8e1d3] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${compact ? "p-3" : "p-4 sm:p-5"} ${props.className ?? ""}`}
    >
      <div className={compact ? "mb-2" : "mb-3.5"}>
        <h2 className={`${compact ? "text-[13px]" : "text-[15px]"} font-semibold tracking-tight text-[#1f2937]`}>{props.title}</h2>
        {props.subtitle ? (
          <p className={`${compact ? "mt-0.5 text-[11px] leading-snug" : "mt-1.5 text-[13px] leading-relaxed"} text-[#4b5563]`}>{props.subtitle}</p>
        ) : null}
      </div>
      {props.children}
    </section>
  );
}

export function StatusPill(props: { tone: HealthTone; label: string; size?: "sm" | "md" }) {
  const sizeClass =
    props.size === "sm"
      ? "px-2 py-0.5 text-[10px]"
      : "px-2.5 py-1 text-xs";
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border font-semibold ${sizeClass} ${tonePillClass(props.tone)}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${toneDotClass(props.tone)}`} />
      {props.label}
    </span>
  );
}

export function MiniSparkline(props: { values: number[]; tone?: "green" | "neutral" }) {
  const values = props.values.length > 0 ? props.values : [0];
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const width = 112;
  const height = 30;
  const pad = 2;
  const span = Math.max(max - min, 1);
  const points = values
    .map((v, i) => {
      const x = values.length === 1 ? width / 2 : (i / (values.length - 1)) * (width - pad * 2) + pad;
      const y = height - ((v - min) / span) * (height - pad * 2) - pad;
      return `${x},${y}`;
    })
    .join(" ");
  const stroke = props.tone === "green" ? "#166534" : "#1f2937";
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-8 w-full max-w-[118px]" aria-hidden>
      <polyline fill="none" stroke={stroke} strokeWidth="3.5" opacity={0.95} points={points} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function DonutChart(props: { segments: Array<{ label: string; value: number; color: string }>; centerLabel: string }) {
  const total = Math.max(
    props.segments.reduce((sum, s) => sum + s.value, 0),
    1,
  );
  const r = 34;
  const c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="flex items-center gap-3">
      <svg viewBox="0 0 100 100" className="h-24 w-24" aria-hidden>
        <g transform="rotate(-90 50 50)">
          {props.segments.map((segment) => {
            const pct = segment.value / total;
            const dash = `${pct * c} ${c - pct * c}`;
            const out = (
              <circle
                key={segment.label}
                cx="50"
                cy="50"
                r={r}
                fill="none"
                stroke={segment.color}
                strokeWidth="12"
                strokeDasharray={dash}
                strokeDashoffset={-acc}
                strokeLinecap="butt"
              />
            );
            acc += pct * c;
            return out;
          })}
        </g>
        <circle cx="50" cy="50" r="22" fill="white" />
        <text x="50" y="50" textAnchor="middle" dominantBaseline="middle" className="fill-[#1f2937] text-[10px] font-semibold">
          {props.centerLabel}
        </text>
      </svg>
      <div className="space-y-1">
        {props.segments.map((segment) => (
          <div key={segment.label} className="flex items-center gap-2 text-xs text-[#4b5563]">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: segment.color }} />
            <span>{segment.label}</span>
            <span className="font-semibold text-[#1f2937]">{segment.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
