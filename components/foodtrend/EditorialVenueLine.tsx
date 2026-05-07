import { pickHasInstagramLink, resolveRestaurantLink, type WherePick } from "./wherePick";
import { VenueSocialBadge } from "./VenueSocialBadge";

export type EditorialVenueVariant = "spot" | "serving" | "compact";

export function EditorialVenueLine({
  pick,
  variant,
  stacked = false,
}: {
  pick: WherePick;
  variant: EditorialVenueVariant;
  /** Magazine layout: neighborhood on its own line below the name. */
  stacked?: boolean;
}) {
  const resolved = resolveRestaurantLink(pick);
  const href = resolved?.url ?? null;
  const badge = resolved?.badge ?? null;
  const showIgGlyph = pickHasInstagramLink(pick);
  const hood = (pick.neighborhood || "LA").trim() || "LA";
  const stackClass =
    variant === "spot"
      ? "ft-editorial-card__venue-stack ft-editorial-card__venue-stack--spot"
      : variant === "serving"
        ? "ft-editorial-card__venue-stack ft-editorial-card__venue-stack--serving"
        : "ft-editorial-card__venue-stack ft-editorial-card__venue-stack--compact";

  const nameBlock = href ? (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="ft-editorial-card__venue-name-link"
    >
      <span className="ft-editorial-card__venue-name-inner">
        <VenueSocialBadge kind={badge} />
        <span className="ft-editorial-card__venue-name">{pick.restaurant}</span>
      </span>
      {showIgGlyph ? (
        <span className="ft-editorial-card__venue-glyph" aria-hidden>
          {" "}
          ↗
        </span>
      ) : null}
    </a>
  ) : (
    <span className="ft-editorial-card__venue-name">{pick.restaurant}</span>
  );

  if (stacked) {
    return (
      <div className={stackClass}>
        <div className="ft-editorial-card__venue-name-line ft-editorial-card__venue-name-line--stacked">{nameBlock}</div>
        <span className="ft-editorial-card__venue-hood-line">{hood}</span>
      </div>
    );
  }

  return (
    <div className={stackClass}>
      <div className="ft-editorial-card__venue-name-line ft-editorial-card__venue-name-line--inline">
        {nameBlock}
        <span className="ft-editorial-card__venue-inline-sep" aria-hidden>
          {" "}
          ·{" "}
        </span>
        <span className="ft-editorial-card__venue-hood-inline">{hood}</span>
      </div>
    </div>
  );
}
