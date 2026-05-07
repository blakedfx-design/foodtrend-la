import type { RestaurantSocialBadge } from "./wherePick";

const INSTA = (
  <svg className="ft-venue-social-badge__svg" viewBox="0 0 24 24" width={12} height={12} aria-hidden>
    <rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="1.35" />
    <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.35" />
    <circle cx="17" cy="7" r="1.15" fill="currentColor" />
  </svg>
);

const TIKTOK = (
  <svg className="ft-venue-social-badge__svg" viewBox="0 0 24 24" width={12} height={12} aria-hidden>
    <path
      d="M16.95 3.45v11.6a4.25 4.25 0 11-3.15-4.1V8.6a6.9 6.9 0 001.35-.16v-2.4a3.1 3.1 0 01-1.35.32V3.45h3.15z"
      fill="currentColor"
    />
  </svg>
);

export function VenueSocialBadge({ kind }: { kind: RestaurantSocialBadge }) {
  if (!kind) {
    return null;
  }
  return (
    <span className={`ft-venue-social-badge ft-venue-social-badge--${kind}`} aria-hidden>
      {kind === "instagram" ? INSTA : TIKTOK}
    </span>
  );
}
