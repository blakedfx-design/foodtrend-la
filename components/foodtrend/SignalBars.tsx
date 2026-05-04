export type SignalBarsProps = {
  /** Row label (e.g. menu spread). Omit in sidebar when the metric name is outside this component. */
  label?: string;
  /** Number of filled squares (0–10). */
  value: number;
};

/** Map a 0–100 percentage to a 0–10 bar fill for `SignalBars`. */
export function pctToBarTen(pct: number): number {
  return Math.min(10, Math.max(0, Math.round(pct / 10)));
}

export function SignalBars({ label, value }: SignalBarsProps) {
  const filled = Math.min(10, Math.max(0, Math.round(value)));

  return (
    <div className={label ? "signal-bars" : "signal-bars signal-bars--compact"}>
      {label ? <div className="signal-bars__label">{label}</div> : null}
      <div className="signal-bars__track" aria-hidden>
        {Array.from({ length: 10 }, (_, i) => (
          <span
            key={i}
            className={i < filled ? "signal-bars__cell signal-bars__cell--on" : "signal-bars__cell"}
          />
        ))}
      </div>
    </div>
  );
}
