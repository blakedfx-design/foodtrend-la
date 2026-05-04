const CREAM = "#f4f1ea";
const SW = 2.1;

export function BurgerIcon() {
  return (
    <svg
      viewBox="0 0 64 64"
      className="trend-icon h-[64px] w-[64px]"
      fill="none"
      stroke="currentColor"
      strokeWidth={SW}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 26 Q32 12 52 26" fill={CREAM} stroke="currentColor" />
      <circle cx="22" cy="22" r={1.35} fill="currentColor" stroke="none" opacity={0.35} />
      <circle cx="30" cy={20} r={1.2} fill="currentColor" stroke="none" opacity={0.35} />
      <circle cx="38" cy="21" r={1.25} fill="currentColor" stroke="none" opacity={0.35} />
      <path d="M14 30 H50 Q52 32 50 34 H14 Q12 32 14 30Z" fill={CREAM} stroke="currentColor" />
      <path d="M16 36 Q32 40 48 36 L46 40 H18 Z" fill={CREAM} stroke="currentColor" opacity={0.95} />
      <path d="M12 42 H52 Q54 44 52 48 Q32 52 12 48 Q10 44 12 42Z" fill={CREAM} stroke="currentColor" />
    </svg>
  );
}

export function IzakayaIcon() {
  return (
    <svg
      viewBox="0 0 64 64"
      className="trend-icon h-[64px] w-[64px]"
      fill="none"
      stroke="currentColor"
      strokeWidth={SW}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 14 H34 L36 18 V22 H20 V18 L22 14Z" fill={CREAM} stroke="currentColor" />
      <path d="M20 22 H36 V46 Q28 50 20 46 V22Z" fill={CREAM} stroke="currentColor" />
      <path d="M42 38 H54 Q56 38 56 40 V48 Q56 52 48 52 Q40 52 40 48 V40 Q40 38 42 38Z" fill={CREAM} stroke="currentColor" />
      <path d="M42 38 V34 Q42 32 48 32 Q54 32 54 34 V38" />
      <path d="M48 32 V28" strokeWidth={1.85} />
    </svg>
  );
}

export function ChiliIcon() {
  return (
    <svg
      viewBox="0 0 64 64"
      className="trend-icon h-[64px] w-[64px]"
      fill="none"
      stroke="currentColor"
      strokeWidth={SW}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="22" y="14" width="20" height="5" rx="1.5" fill={CREAM} stroke="currentColor" />
      <rect x="18" y="22" width="28" height="32" rx="5" fill={CREAM} stroke="currentColor" />
      <path d="M22 30 H42 V40 H22 Z" fill={CREAM} stroke="currentColor" strokeWidth={1.65} />
      <path d="M28 34 Q30 32 32 34 Q31 37 29 36 Z" fill="currentColor" stroke="currentColor" opacity={0.2} strokeWidth={1.35} />
      <path d="M44 26 L40 44" strokeWidth={1.85} />
      <ellipse cx="45" cy="24" rx="3" ry="2" fill={CREAM} stroke="currentColor" />
    </svg>
  );
}

export function BagelIcon() {
  return (
    <svg
      viewBox="0 0 64 64"
      className="trend-icon h-[64px] w-[64px]"
      fill="none"
      stroke="currentColor"
      strokeWidth={SW}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="32" cy="32" r={18} fill={CREAM} stroke="currentColor" />
      <circle cx="32" cy="32" r={6} />
      <circle cx={24} cy={26} r={1.1} fill="currentColor" stroke="none" opacity={0.3} />
      <circle cx={30} cy={24} r={1} fill="currentColor" stroke="none" opacity={0.28} />
      <circle cx={38} cy={26} r={1.05} fill="currentColor" stroke="none" opacity={0.3} />
      <circle cx={36} cy={34} r={0.95} fill="currentColor" stroke="none" opacity={0.26} />
      <circle cx={28} cy={36} r={1} fill="currentColor" stroke="none" opacity={0.28} />
    </svg>
  );
}

export function SnackIcon() {
  return (
    <svg
      viewBox="0 0 64 64"
      className="trend-icon h-[64px] w-[64px]"
      fill="none"
      stroke="currentColor"
      strokeWidth={SW}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 34 Q32 54 52 34 L46 48 H18 Z" fill={CREAM} stroke="currentColor" />
      <ellipse cx="26" cy="38" rx="5" ry="4.5" fill={CREAM} stroke="currentColor" />
      <ellipse cx="34" cy="37" rx="5.5" ry="5" fill={CREAM} stroke="currentColor" />
      <ellipse cx="42" cy="39" rx="4.5" ry="4" fill={CREAM} stroke="currentColor" />
    </svg>
  );
}
