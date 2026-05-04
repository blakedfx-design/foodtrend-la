/**
 * Foodtrend LA editorial SVG icons (48×48).
 * Core exports: BurgerIcon, IzakayaIcon, ChiliJarIcon, BagelIcon, FermentJarIcon, SnackBowlIcon, SoftServeIcon.
 */
type IconProps = {
  className?: string;
};

const base = "food-icon";

export function BurgerIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 48 48" className={`${base} ${className}`} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path className="icon-accent" d="M10 24c2-8 26-8 28 0H10Z" />
      <path d="M10 24c2-8 26-8 28 0" />
      <path d="M11 27h26" />
      <path d="M13 31h22" />
      <path d="M11 35h26" />
      <path d="M14 38h20" />
    </svg>
  );
}

export function IzakayaIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 48 48" className={`${base} ${className}`} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 10h10l2 27H14l2-27Z" />
      <path d="M18 16h7" />
      <path d="M32 25h6v12h-8V27c0-1 1-2 2-2Z" />
      <path d="M33 21h4" />
    </svg>
  );
}

export function ChiliJarIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 48 48" className={`${base} ${className}`} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path className="icon-accent" d="M15 17h18v27H15z" />
      <path d="M16 17h18v26H16z" />
      <path d="M18 11h14v6H18z" />
      <path d="M24 31c5-1 8-5 8-10" />
      <path d="M24 31c-2-4 0-7 4-8" />
      <path d="M20 24h3" />
    </svg>
  );
}

export function BagelIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 48 48" className={`${base} ${className}`} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle className="icon-accent" cx="24" cy="24" r="15" />
      <circle cx="24" cy="24" r="15" />
      <circle cx="24" cy="24" r="5" />
      <path d="M15 20c4-3 14-3 18 0" />
    </svg>
  );
}

export function SnackBowlIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 48 48" className={`${base} ${className}`} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 24h28l-4 15H14L10 24Z" />
      <path d="M14 24c2-5 6-7 10-3 4-5 9-3 10 3" />
      <circle cx="18" cy="19" r="2" />
      <circle cx="27" cy="17" r="2" />
      <circle cx="34" cy="20" r="2" />
    </svg>
  );
}

export function FermentJarIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 48 48" className={`${base} ${className}`} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 14h14" />
      <path d="M19 9h10v5H19z" />
      <path d="M16 14h16l-2 31H18l-2-31Z" />
      <path d="M20 25c4 3 8-3 12 0" />
      <path d="M20 31c4 3 8-3 12 0" />
    </svg>
  );
}

export function SoftServeIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 48 48" className={`${base} ${className}`} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M24 8c6 3 4 8-1 9 8 1 10 7 1 10 8 1 7 8-4 8" />
      <path d="M16 35h16l-8 10-8-10Z" />
    </svg>
  );
}

export function PozoleIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 48 48" className={`${base} ${className}`} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 25h28c-1 10-6 15-14 15S11 35 10 25Z" />
      <path d="M14 25c4-4 16-4 20 0" />
      <circle cx="19" cy="30" r="1.5" />
      <circle cx="25" cy="32" r="1.5" />
      <circle cx="31" cy="29" r="1.5" />
      <path d="M35 18c3 1 5 3 6 6" />
    </svg>
  );
}

export function CustardPieIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 48 48" className={`${base} ${className}`} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path className="icon-accent" d="M9 30h30l-5 10H14z" />
      <path d="M9 30h30l-5 10H14L9 30Z" />
      <path d="M13 30c2-8 20-12 25 0" />
      <path d="M18 25c3 2 6 2 9 0" />
    </svg>
  );
}

export function SignalBarsIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 48 48" className={`${base} ${className}`} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 36V24" />
      <path d="M20 36V18" />
      <path d="M28 36V12" />
      <path d="M36 36V8" />
      <path d="M9 36h30" />
    </svg>
  );
}

export function SourceDatabaseIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 48 48" className={`${base} ${className}`} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="24" cy="12" rx="13" ry="5" />
      <path d="M11 12v24c0 3 6 5 13 5s13-2 13-5V12" />
      <path d="M11 24c0 3 6 5 13 5s13-2 13-5" />
    </svg>
  );
}

export function ShareIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 48 48" className={`${base} ${className}`} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="16" cy="24" r="4" />
      <circle cx="32" cy="14" r="4" />
      <circle cx="32" cy="34" r="4" />
      <path d="M19.5 22l9-6" />
      <path d="M19.5 26l9 6" />
    </svg>
  );
}
