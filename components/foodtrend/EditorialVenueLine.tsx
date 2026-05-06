import { getRestaurantUrl, type WherePick } from "./wherePick";

export type EditorialVenueVariant = "spot" | "serving" | "compact";

export function EditorialVenueLine({
  pick,
  variant,
}: {
  pick: WherePick;
  variant: EditorialVenueVariant;
}) {
  const href = getRestaurantUrl(pick);
  const hood = (pick.neighborhood || "LA").trim() || "LA";
  const stackClass =
    variant === "spot"
      ? "ft-editorial-card__venue-stack ft-editorial-card__venue-stack--spot"
      : variant === "serving"
        ? "ft-editorial-card__venue-stack ft-editorial-card__venue-stack--serving"
        : "ft-editorial-card__venue-stack ft-editorial-card__venue-stack--compact";

  return (
    <div className={stackClass}>
      <div className="ft-editorial-card__venue-name-line">
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="ft-editorial-card__venue-name-link"
          >
            <span className="ft-editorial-card__venue-name">{pick.restaurant}</span>
            <span className="ft-editorial-card__venue-glyph" aria-hidden>
              {" "}
              ↗
            </span>
          </a>
        ) : (
          <span className="ft-editorial-card__venue-name">{pick.restaurant}</span>
        )}
      </div>
      <span className="ft-editorial-card__venue-hood-line">{hood}</span>
    </div>
  );
}
